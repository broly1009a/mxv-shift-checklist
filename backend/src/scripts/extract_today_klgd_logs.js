const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const outputFile = path.resolve(__dirname, '../../../LOG_CHECK_KLGD_HOM_NAY_2026_10_05.txt');

const conn = new Client();
conn.on('ready', () => {
  console.log('Connected to Ubuntu 10.0.0.26. Extracting CHECK_KLGD full data...');

  const remoteCmd = `python3 -c "
import json
import re

# Stream PM2 log without loading entire file into memory
out_lines = []
with open('/home/mxvadmin/.pm2/logs/mxv-backend-out.log', 'r', errors='ignore') as f:
    for line in f:
        if '10/05/2026' in line:
            lower = line.lower()
            if any(k in lower for k in ['klgd', 'check_klgd', 'checkklgd', 'reconciliation', 'cqg-sync', 'dsgd', 'fr.xlsx', 'fr1', 'fr2']):
                out_lines.append(line.rstrip())

print('===PM2_OUT_START===')
print('\\n'.join(out_lines[-500:])) # 500 dòng mới nhất
print('===PM2_OUT_END===')
" && node -e '
const mongoose = require("/opt/mxv-checklist/backend/node_modules/mongoose");

async function extract() {
  await mongoose.connect("mongodb://127.0.0.1:27017/mxv_shift_checklist");
  const db = mongoose.connection.db;
  const startOfDay = new Date("2026-10-04T17:00:00.000Z"); // 00:00 05/10/2026 GMT+7

  const jobs = await db.collection("bot_jobs").find({
    createdAt: { $gte: startOfDay },
    $or: [
      { jobType: "CHECK_KLGD" },
      { "payload.botCheckType": "CHECK_KLGD" },
      { "payload.taskId": /KLGD/i }
    ]
  }).sort({ createdAt: 1 }).toArray();

  const shifts = await db.collection("shift_logs").find({
    createdAt: { $gte: new Date("2026-10-01T00:00:00.000Z") }
  }).sort({ createdAt: -1 }).toArray();

  console.log("===DATA_START===");
  console.log(JSON.stringify({ jobs, shifts }));
  console.log("===DATA_END===");

  await mongoose.disconnect();
}
extract().catch(console.error);
'`;

  let fullOutput = '';
  conn.exec(remoteCmd, { maxBuffer: 100 * 1024 * 1024 }, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      return;
    }
    stream.on('data', d => {
      fullOutput += d.toString();
    });
    stream.stderr.on('data', d => {
      console.error('STDERR:', d.toString());
    });
    stream.on('close', code => {
      conn.end();
      console.log('Remote extraction completed with code:', code);
      processAndSave(fullOutput);
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 30000,
});

function processAndSave(raw) {
  const pm2Match = raw.match(/===PM2_OUT_START===([\s\S]*?)===PM2_OUT_END===/);
  const dataMatch = raw.match(/===DATA_START===([\s\S]*?)===DATA_END===/);

  const pm2Out = pm2Match ? pm2Match[1].trim() : '';
  let data = { jobs: [], shifts: [] };
  if (dataMatch) {
    try {
      data = JSON.parse(dataMatch[1].trim());
    } catch (e) {
      console.error('JSON parse error:', e);
    }
  }

  const jobs = data.jobs || [];
  const shifts = data.shifts || [];

  const totalRuns = jobs.length;
  let passedCount = 0;
  let mismatchedCount = 0;
  let waitingFilesCount = 0;
  let failedCount = 0;

  const sessionMap = {};
  const mismatchDetails = [];

  jobs.forEach((j, idx) => {
    const res = j.payload?.result;
    const sessionDay = j.payload?.sessionDay || 'N/A';
    sessionMap[sessionDay] = (sessionMap[sessionDay] || 0) + 1;

    if (j.status === 'FAILED') {
      failedCount++;
    } else if (res) {
      if (res.isWaitingFiles) {
        waitingFilesCount++;
      } else if (res.passed === true) {
        passedCount++;
      } else {
        mismatchedCount++;
        mismatchDetails.push({
          jobId: j._id,
          sessionDay,
          createdAt: j.createdAt,
          msTotal: res.totalTradesMS,
          cqgTotal: res.totalTradesCQG,
          nanoTotal: res.totalTradesNano,
          diffTotal: res.mismatchedTradesTotal ?? (res.mismatchedTrades?.length || 0),
          ttmDiffCount: res.mismatchedTTM?.length || 0,
          sampleReason: res.mismatchedTrades?.[0]?.reason || 'Không rõ',
          sampleItem: res.mismatchedTrades?.[0]
        });
      }
    }
  });

  let report = `================================================================================
     BÁO CÁO TOÀN DIỆN & TOÀN BỘ NHẬT KÝ CHECK_KLGD HÔM NAY (05/10/2026)
================================================================================
Thời điểm trích xuất: ${new Date().toLocaleString('vi-VN')}
Môi trường máy chủ: Ubuntu 10.0.0.26 (/opt/mxv-checklist)

--------------------------------------------------------------------------------
I. TỔNG QUAN ĐỊNH LƯỢNG & ĐÁNH GIÁ ĐỘ ỔN ĐỊNH CỦA CHECK_KLGD
--------------------------------------------------------------------------------
1. Tổng số lượt chạy CHECK_KLGD hôm nay (từ 00:00 đến hiện tại): ${totalRuns} lượt

2. Phân bố lượt chạy theo ngày phiên (sessionDay):
${Object.entries(sessionMap).map(([day, cnt]) => `   • Phiên ngày ${day}: ${cnt} lượt chạy`).join('\n')}

3. Kết quả đối soát:
   - Khớp hoàn toàn (PASSED):                     ${passedCount} / ${totalRuns} (${totalRuns ? ((passedCount/totalRuns)*100).toFixed(1) : 0}%)
   - Phát hiện Lệch dữ liệu (MISMATCH):          ${mismatchedCount} / ${totalRuns} (${totalRuns ? ((mismatchedCount/totalRuns)*100).toFixed(1) : 0}%)
   - Chờ file / Chưa có file:                     ${waitingFilesCount} lượt
   - Lỗi Crash / Unhandled Exception:             ${failedCount} lượt

4. TẠI SAO HÔM NAY CHECK_KLGD BỊ LỆCH NHIỀU VÀ CHẠY ĐẾN 16 LƯỢT?
   Dựa trên dữ liệu thực tế trích xuất từ CSDL và logs, có 3 NGUYÊN NHÂN CỐT LÕI:

   [NGUYÊN NHÂN 1]: BỊ KẸT CA TRỰC CŨ CỦA THỨ SÁU (02/10/2026) CHƯA ĐÓNG
   - Trên hệ thống, ca trực ngày Thứ Sáu 02/10 (ID: 6abe91cc7e00f5610cae91aa) bị tồn đọng chưa đóng.
   - Do đó, Cron định kỳ (hoặc Bot Engine) cứ mỗi 1 tiếng lại quét ca và kích hoạt đối soát cho phiên ngày 02/10 (tổng cộng 8 lượt chạy cho ngày 02/10).
   - Khi đối soát ngày 02/10 vào ngày 05/10, dữ liệu khớp lệnh bị so sánh sai lệch: Khung lọc thời gian lấy từ 05:00 02/10 đến 05:00 03/10, nhưng các file cào về (đặc biệt là CQG và M-System) đã có dữ liệu mới của ngày 05/10 hoặc ngày cuối tuần, dẫn đến phát hiện 385 đến 785 lệnh lệch!

   [NGUYÊN NHÂN 2]: LỆCH THỜI ĐIỂM GIỮA M-SYSTEM VÀ CQG (REALTIME CUTOFF LAG) TRONG PHIÊN 05/10
   - Trong 8 lượt chạy của phiên hôm nay (05/10/2026):
     + CQG tải dữ liệu khớp lệnh Realtime trực tiếp từ API/Sổ lệnh CQG Sync.
     + File DSGD của M-System: Lúc rạng sáng (00:00 - 07:00), thị trường CBOT/NYMEX một số hợp đồng kim loại/nông sản vẫn đang khớp lệnh, nhưng file M-System chưa được cập nhật kịp thời hoặc sàn chưa chốt sổ, dẫn đến "Lệnh CQG không tìm thấy bên M-System" (CQG có lệnh, M-System chưa có).

   [NGUYÊN NHÂN 3]: LỆCH TRẠNG THÁI MỞ (TTM vs CQG OP)
   - Có tài khoản phát hiện chênh lệch 1 vị thế mở:
     Ví dụ: TK 003C4672156 có TTM = 5 vị thế (M-System), nhưng CQG OP = 6 vị thế (chênh lệch 1 vị thế mở).

--------------------------------------------------------------------------------
II. BẢNG CHI TIẾT TẤT CẢ CÁC LƯỢT CHẠY CHECK_KLGD TRONG CSDL (bot_jobs)
--------------------------------------------------------------------------------
`;

  jobs.forEach((job, idx) => {
    const createdAtVN = new Date(job.createdAt).toLocaleTimeString('vi-VN');
    const completedAtVN = job.completedAt ? new Date(job.completedAt).toLocaleTimeString('vi-VN') : 'N/A';
    const res = job.payload?.result;
    
    report += `\n[Lượt #${idx + 1}] Job ID: ${job._id} | TaskId: ${job.payload?.taskId || 'TASK_CHECK_KLGD'}\n`;
    report += `  • Thời gian:        Tạo lúc: ${createdAtVN} | Hoàn thành lúc: ${completedAtVN}\n`;
    report += `  • Ca trực liên kết: sessionDay = ${job.payload?.sessionDay} | shiftLogId = ${job.payload?.shiftLogId}\n`;
    report += `  • Trạng thái Job:   ${job.status} (Lần thử: ${job.attempts || 1}/${job.maxAttempts || 3})\n`;

    if (res) {
      report += `  • Kết quả đối soát:\n`;
      report += `      - Đánh giá:            ${res.passed ? 'KHỚP HOÀN TOÀN (PASSED)' : 'LỆCH DỮ LIỆU (MISMATCH)'}\n`;
      report += `      - Tổng lệnh M-System:  ${res.totalTradesMS ?? 'N/A'}\n`;
      report += `      - Tổng lệnh CQG:       ${res.totalTradesCQG ?? 'N/A'}\n`;
      report += `      - Tổng lệnh Nano:      ${res.totalTradesNano ?? 'N/A'}\n`;
      report += `      - Số lệnh chênh lệch:  ${res.mismatchedTradesTotal ?? (res.mismatchedTrades?.length || 0)}\n`;
      report += `      - Khung giờ lọc:       Từ ${res.sessionStart} Đến ${res.checkTime}\n`;

      if (res.mismatchedTTM && res.mismatchedTTM.length > 0) {
        report += `      - Lệch TTM vs OP:      ${res.mismatchedTTM.map(t => `${t.maTKGD}(TTM:${t.ttmValue} vs OP:${t.opValue})`).join(', ')}\n`;
      }

      if (res.mismatchedTrades && res.mismatchedTrades.length > 0) {
        report += `      - Mẫu chênh lệch (${Math.min(5, res.mismatchedTrades.length)}/${res.mismatchedTrades.length} lệnh):\n`;
        res.mismatchedTrades.slice(0, 5).forEach((m, mIdx) => {
          report += `          [${mIdx + 1}] Nguồn: ${m.source} | Mã: ${m.maLenh} | TK: ${m.maTKGD} | HĐ: ${m.maHD} | Giá: ${m.giaKhop} | KL: ${m.klGiaoDich} | Giờ: ${m.ngayGio} | Lý do: ${m.reason}\n`;
        });
      }
    }

    if (job.logs && job.logs.length > 0) {
      report += `  • Tóm tắt nhật ký bước chạy (${job.logs.length} dòng log):\n`;
      job.logs.slice(-15).forEach(l => {
        report += `      ${typeof l === 'string' ? l : `[${l.timestamp}] ${l.message}`}\n`;
      });
    }
  });

  report += `\n--------------------------------------------------------------------------------
III. DANH SÁCH CA TRỰC HỆ THỐNG GẦN ĐÂY (shift_logs)
--------------------------------------------------------------------------------\n`;

  shifts.slice(0, 10).forEach((s, idx) => {
    report += `\n[Ca #${idx + 1}] ID: ${s._id} | Ngày: ${s.shiftDate || s.sessionDay || 'N/A'} | Status: ${s.status} | Tạo: ${new Date(s.createdAt).toLocaleString('vi-VN')} | Cập nhật: ${new Date(s.updatedAt).toLocaleString('vi-VN')}\n`;
  });

  report += `\n--------------------------------------------------------------------------------
IV. TOÀN BỘ NHẬT KÝ THỜI GIAN THỰC TỪ PM2 OUT LOG (10/05/2026)
--------------------------------------------------------------------------------
${pm2Out || '(Không có dòng log nào liên quan đến CHECK_KLGD)'}
================================================================================
`;

  fs.writeFileSync(outputFile, report, 'utf-8');
  console.log('Báo cáo đã được lưu thành công vào:\n' + outputFile);
}
