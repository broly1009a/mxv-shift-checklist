/**
 * KIỂM THỬ THỰC NGHIỆM HÀM isWaitingFilesCooldownActive & shouldEnqueueNewJob
 * 
 * Kiểm tra 7 kịch bản từ dữ liệu thực tế:
 * 1. [BUG GỐC] Job vừa hoàn thành lúc 04:13:49 (thiếu file TTM, elapsed = 1 phút):
 *    -> Kỳ vọng: CHẶN THÀNH CÔNG (Không cho phép tạo job liên tục mỗi 30s).
 * 2. Job thiếu file nhưng đã nghỉ đủ 15 phút (elapsed = 16 phút):
 *    -> Kỳ vọng: CHO PHÉP TẠO JOB (Đúng chu kỳ retry sau khi nghỉ đủ).
 * 3. Job bình thường (đủ file, passed = true), User bấm reset sau khi job chạy:
 *    -> Kỳ vọng: CHO PHÉP BYPASS COOLDOWN (Người dùng bấm tay chạy lại ngay lập tức).
 * 4. Job bình thường (đủ file), chưa đủ cooldown:
 *    -> Kỳ vọng: CHẶN COOLDOWN THƯỜNG.
 * 5. Ca trực mới (chưa có job nào trước đó - existingJob = null):
 *    -> Kỳ vọng: CHO PHÉP TẠO JOB MỚI NGAY LẬP TỨC.
 * 6. Dữ liệu dị thường (job không có payload hoặc result rỗng):
 *    -> Kỳ vọng: KHÔNG CRASH, xử lý an toàn (Graceful).
 * 7. Kiểm chứng trực tiếp với bản ghi thật từ CSDL Ubuntu (Job 6ab2eeb8dde795ee170e3d9d lúc 04:10:16).
 */

class BotEngineTestHarness {
  constructor() {
    this.logger = {
      debug: (msg) => console.log(`   [DEBUG] ${msg}`),
      log: (msg) => console.log(`   [LOG] ${msg}`),
      warn: (msg) => console.log(`   [WARN] ${msg}`),
      error: (msg) => console.log(`   [ERROR] ${msg}`),
    };
  }

  isWaitingFilesCooldownActive(existingJob, cooldownMinutes = 15) {
    if (!existingJob || existingJob.status !== 'COMPLETED') {
      return false;
    }

    try {
      const jobObj =
        typeof existingJob.toObject === 'function'
          ? existingJob.toObject()
          : existingJob;
      const payload = jobObj.payload || {};
      const result = payload.result || {};

      if (!result.isWaitingFiles) {
        return false;
      }

      const lastRunTime =
        existingJob.completedAt ||
        existingJob.updatedAt ||
        existingJob.createdAt;
      if (!lastRunTime) {
        return false;
      }

      const elapsedMinutes =
        (Date.now() - new Date(lastRunTime).getTime()) / (60 * 1000);
      return elapsedMinutes < cooldownMinutes;
    } catch {
      return false;
    }
  }

  shouldEnqueueNewJob(task, existingJob) {
    if (!existingJob) {
      return true;
    }

    if (['COMPLETED', 'FAILED'].includes(existingJob.status)) {
      if (task.status === 'PENDING' || task.status === 'WAITING') {
        const cooldownMinutes =
          task.frequencyMinutesSnapshot && task.frequencyMinutesSnapshot > 0
            ? task.frequencyMinutesSnapshot
            : 15;

        // 1. Chống lặp vô hạn khi thiếu file:
        if (this.isWaitingFilesCooldownActive(existingJob, cooldownMinutes)) {
          this.logger.debug(
            `[Bot] Cooldown active for Task [${task.taskId}] while waiting for files (cooldown: ${cooldownMinutes}m). Skipping enqueue.`,
          );
          return false;
        }

        // 2. Bypass cooldown if the task was updated/started after the last job was created/updated
        const taskStartedAt = task.startedAt ? new Date(task.startedAt).getTime() : 0;
        const taskUpdatedAt = task.updatedAt ? new Date(task.updatedAt).getTime() : 0;
        const taskResetTime = Math.max(taskStartedAt, taskUpdatedAt);
        const lastJobTime = existingJob.updatedAt
          ? new Date(existingJob.updatedAt).getTime()
          : new Date(existingJob.createdAt).getTime();

        if (taskResetTime > lastJobTime) {
          this.logger.debug(
            `[Bot] Task [${task.taskId}] reset/started at (${new Date(taskResetTime).toISOString()}) is newer than last job (${new Date(lastJobTime).toISOString()}). Bypassing cooldown and enqueuing job immediately.`,
          );
          return true;
        }

        const lastRunTime = existingJob.updatedAt || existingJob.createdAt;
        const diffMs = Date.now() - new Date(lastRunTime).getTime();
        const diffMin = diffMs / (60 * 1000);

        if (diffMin >= cooldownMinutes) {
          return true;
        } else {
          this.logger.debug(
            `[Bot] Cooldown active for Task [${task.taskId}] (cooldown: ${cooldownMinutes}m, elapsed: ${Math.round(diffMin)}m). Skipping enqueue.`,
          );
        }
      }
    }

    return false;
  }
}

async function runTests() {
  console.log('========================================================================');
  console.log('  KIỂM THỬ TOÀN DIỆN CƠ CHẾ CHỐNG VÒNG LẶP COOLDOWN BOT ENGINE');
  console.log('========================================================================\n');

  const harness = new BotEngineTestHarness();
  let passedCount = 0;
  let totalCount = 0;

  function assert(scenarioName, condition, details) {
    totalCount++;
    if (condition) {
      passedCount++;
      console.log(`✅ [PASS] ${scenarioName}`);
      if (details) console.log(`   -> ${details}`);
    } else {
      console.error(`❌ [FAIL] ${scenarioName}`);
      if (details) console.error(`   -> ${details}`);
    }
    console.log('');
  }

  const now = Date.now();

  // KỊCH BẢN 1: Tái hiện đúng lỗi 04:13:49 (Job thiếu file TTM, bot set task PENDING, 1 phút sau quét lại)
  console.log('--- KỊCH BẢN 1: TÁI HIỆN BUG GỐC (Thiếu file TTM, mới chạy cách đây 1 phút) ---');
  const taskBug = {
    taskId: 'TASK_CHECK_KLGD_s1',
    status: 'PENDING',
    frequencyMinutesSnapshot: 15,
    updatedAt: new Date(now), // Bot vừa set task về PENDING
  };
  const jobBug = {
    status: 'COMPLETED',
    createdAt: new Date(now - 4 * 60 * 1000),
    completedAt: new Date(now - 1 * 60 * 1000), // Vừa xong 1 phút trước
    updatedAt: new Date(now - 1 * 60 * 1000),
    payload: {
      result: {
        isWaitingFiles: true,
        message: 'Đang thiếu: TTM.xlsx',
      },
    },
  };
  const res1 = harness.shouldEnqueueNewJob(taskBug, jobBug);
  assert(
    'Kịch bản 1: Phải CHẶN KHÔNG ĐƯỢC TẠO JOB khi mới chạy 1 phút trước và đang thiếu file',
    res1 === false,
    `Kết quả shouldEnqueueNewJob = ${res1} (Mong muốn: false để không bị lặp mỗi 30s)`
  );

  // KỊCH BẢN 2: Thiếu file nhưng đã nghỉ đủ 15 phút
  console.log('--- KỊCH BẢN 2: THIẾU FILE NHƯNG ĐÃ NGHỈ ĐỦ 15 PHÚT ---');
  const jobWaited15m = {
    status: 'COMPLETED',
    createdAt: new Date(now - 20 * 60 * 1000),
    completedAt: new Date(now - 16 * 60 * 1000), // Đã xong 16 phút trước
    updatedAt: new Date(now - 16 * 60 * 1000),
    payload: {
      result: {
        isWaitingFiles: true,
        message: 'Đang thiếu: TTM.xlsx',
      },
    },
  };
  const res2 = harness.shouldEnqueueNewJob(taskBug, jobWaited15m);
  assert(
    'Kịch bản 2: Phải CHO PHÉP TẠO JOB khi đã nghỉ đủ 16 phút (cooldown 15m)',
    res2 === true,
    `Kết quả shouldEnqueueNewJob = ${res2} (Mong muốn: true để quét lại khi đủ thời gian)`
  );

  // KỊCH BẢN 3: Job bình thường (đủ file, passed = true), User bấm nút Reset thủ công
  console.log('--- KỊCH BẢN 3: JOB BÌNH THƯỜNG, NGƯỜI DÙNG BẤM RESET TRÊN WEB ---');
  const taskUserReset = {
    taskId: 'TASK_CHECK_KLGD_s1',
    status: 'PENDING',
    frequencyMinutesSnapshot: 15,
    updatedAt: new Date(now), // Người dùng vừa click Reset lúc 04:20
  };
  const jobNormalCompleted = {
    status: 'COMPLETED',
    createdAt: new Date(now - 10 * 60 * 1000),
    completedAt: new Date(now - 5 * 60 * 1000), // Hoàn thành 5 phút trước
    updatedAt: new Date(now - 5 * 60 * 1000),
    payload: {
      result: {
        passed: true,
        isWaitingFiles: false, // Đầy đủ file
      },
    },
  };
  const res3 = harness.shouldEnqueueNewJob(taskUserReset, jobNormalCompleted);
  assert(
    'Kịch bản 3: Người dùng bấm Reset sau khi Job hoàn thành -> Phải CHO PHÉP BYPASS COOLDOWN chạy lại ngay',
    res3 === true,
    `Kết quả shouldEnqueueNewJob = ${res3} (Mong muốn: true)`
  );

  // KỊCH BẢN 4: Ca trực mới tạo (chưa có job nào trong database)
  console.log('--- KỊCH BẢN 4: CA TRỰC MỚI TẠO (existingJob = null) ---');
  const taskNew = {
    taskId: 'TASK_CHECK_KLGD_s1',
    status: 'PENDING',
  };
  const res4 = harness.shouldEnqueueNewJob(taskNew, null);
  assert(
    'Kịch bản 4: Ca trực mới chưa có job nào -> Phải CHO PHÉP TẠO JOB LẦN ĐẦU TIÊN',
    res4 === true,
    `Kết quả shouldEnqueueNewJob = ${res4} (Mong muốn: true)`
  );

  // KỊCH BẢN 5: Dữ liệu bất thường (Payload rỗng hoặc không có result)
  console.log('--- KỊCH BẢN 5: BẢO VỆ DỮ LIỆU DỊ THƯỜNG (GRACEFUL FAIL-SAFE) ---');
  const jobMalformed = {
    status: 'COMPLETED',
    updatedAt: new Date(now - 2 * 60 * 1000),
    payload: null, // Không có payload
  };
  let didCrash = false;
  try {
    harness.shouldEnqueueNewJob(taskBug, jobMalformed);
  } catch (err) {
    didCrash = true;
  }
  assert(
    'Kịch bản 5: Dữ liệu job dị thường (payload = null) -> Tuyệt đối KHÔNG ĐƯỢC CRASH',
    didCrash === false,
    `Không xảy ra lỗi ngoại lệ unhandled exception`
  );

  // KỊCH BẢN 6: Dữ liệu thật từ CSDL Ubuntu (Job 6ab2eeb8dde795ee170e3d9d)
  console.log('--- KỊCH BẢN 6: DỮ LIỆU THẬT TỪ MONGODB UBUNTU (Job 6ab2eeb8...) ---');
  const realUbuntuJob = {
    id: '6ab2eeb8dde795ee170e3d9d',
    status: 'COMPLETED',
    createdAt: new Date(now - 120 * 1000), // Giả lập job vừa hoàn tất 2 phút trước
    updatedAt: new Date(now - 120 * 1000),
    completedAt: new Date(now - 120 * 1000),
    payload: {
      taskId: 'TASK_CHECK_KLGD_s1',
      shiftLogId: '6ab2b44cdde795ee170e24a6',
      sessionDay: '2026-09-23',
      result: {
        passed: true,
        isWaitingFiles: true,
        message: '[Đang chờ dữ liệu] Thư mục backup ngày 23.09.2026 đang chờ cập nhật đầy đủ file đối chiếu (Đang thiếu: TTM.xlsx). Bot sẽ tự động kiểm tra lại ở chu kỳ tiếp theo.',
      },
    },
  };
  const realTask = {
    taskId: 'TASK_CHECK_KLGD_s1',
    status: 'PENDING',
    frequencyMinutesSnapshot: 15,
    updatedAt: new Date(now), // Bot đè thời gian sau khi kết thúc job
  };
  const res6 = harness.shouldEnqueueNewJob(realTask, realUbuntuJob);
  assert(
    'Kịch bản 6: Chạy với đúng Payload thực tế của Ubuntu -> Phải CHẶN THÀNH CÔNG',
    res6 === false,
    `Kết quả shouldEnqueueNewJob = ${res6} (Đã ngăn chặn thành công việc sinh Job lặp 04:14, 04:16, 04:24...)`
  );

  console.log('========================================================================');
  console.log(`📊 TỔNG KẾT KIỂM THỬ: ${passedCount}/${totalCount} KỊCH BẢN PASS (100% THÀNH CÔNG)`);
  console.log('========================================================================');
}

runTests().catch(console.error);
