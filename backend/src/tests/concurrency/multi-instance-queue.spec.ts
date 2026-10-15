import { BotDispatcherService } from '../../modules/checklist-hub/dispatcher/bot-dispatcher.service';
import { IBotWorker, TaskExecutionContext, TaskExecutionResult } from '../../shared';

describe('Multi-Instance Concurrency Test - Khóa Nguyên Tử Đa Instance (Zero Race Condition)', () => {
  // Giả lập In-Memory Mongo Collection có hỗ trợ findOneAndUpdate nguyên tử
  class MockAtomicBotJobCollection {
    private jobs: Array<{
      _id: string;
      jobType: string;
      status: string;
      lockedBy?: string;
      lockedAt?: Date;
      payload: any;
      attempts: number;
    }> = [];

    addJob(job: any) {
      this.jobs.push({
        _id: job._id || `job_${Math.random().toString(36).slice(2, 8)}`,
        jobType: job.jobType,
        status: job.status || 'PENDING',
        payload: job.payload || {},
        attempts: 0,
      });
    }

    // Mô phỏng chính xác hành vi nguyên tử của MongoDB findOneAndUpdate
    async findOneAndUpdate(filter: any, update: any, options: any) {
      const match = this.jobs.find((j) => {
        if (filter.status && j.status !== filter.status) return false;
        return true;
      });

      if (!match) return null;

      if (update.$set) {
        Object.assign(match, update.$set);
      }
      if (update.$inc) {
        for (const [k, v] of Object.entries(update.$inc)) {
          (match as any)[k] = ((match as any)[k] || 0) + (v as number);
        }
      }

      return {
        ...match,
        toObject: () => ({ ...match }),
      };
    }

    async updateOne(filter: any, update: any) {
      const match = this.jobs.find((j) => j._id === filter._id);
      if (match && update.$set) {
        Object.assign(match, update.$set);
      }
      return { modifiedCount: 1 };
    }

    getAllJobs() {
      return this.jobs;
    }
  }

  it('2 Worker Instances cùng tranh chấp 10 Jobs: 0 Job bị chạy trùng lặp (Zero Double-Execution)', async () => {
    const mockDb = new MockAtomicBotJobCollection();

    // Tạo 10 Jobs PENDING
    for (let i = 1; i <= 10; i++) {
      mockDb.addJob({
        _id: `JOB_${i.toString().padStart(3, '0')}`,
        jobType: 'CHECK_KLGD',
        payload: { taskId: `TASK_${i}`, botCheckType: 'CHECK_KLGD' },
      });
    }

    // Mock Dummy Worker
    const executedByJob = new Map<string, string[]>();
    const dummyWorker: IBotWorker = {
      capabilityType: 'CHECK_KLGD',
      displayName: 'Dummy KLGD Worker',
      canHandle: (c) => c === 'CHECK_KLGD',
      execute: async (ctx: TaskExecutionContext): Promise<TaskExecutionResult> => {
        return {
          status: 'SUCCESS',
          summary: `Thực thi thành công task ${ctx.taskId}`,
          durationMs: 5,
          executedAt: new Date(),
        };
      },
    };

    // Tạo 2 Instance Dispatcher độc lập (Instance A & Instance B)
    const dispatcherA = new BotDispatcherService(mockDb as any);
    (dispatcherA as any).instanceId = 'INSTANCE_NODE_A';
    dispatcherA.registerWorker(dummyWorker);

    const dispatcherB = new BotDispatcherService(mockDb as any);
    (dispatcherB as any).instanceId = 'INSTANCE_NODE_B';
    dispatcherB.registerWorker(dummyWorker);

    // Cho cả 2 instances cùng tranh nhau lấy job song song
    const processPromises: Promise<any>[] = [];
    for (let i = 0; i < 10; i++) {
      // Instance A và Instance B cùng gọi đồng thời
      processPromises.push(dispatcherA.acquireAndProcessNextJob());
      processPromises.push(dispatcherB.acquireAndProcessNextJob());
    }

    const results = await Promise.all(processPromises);
    const nonNullResults = results.filter((r) => r !== null);

    // Tổng số lượt nhận job thành công phải chính xác là 10 (mỗi job chỉ 1 instance lấy)
    expect(nonNullResults.length).toBe(10);

    const allJobs = mockDb.getAllJobs();
    expect(allJobs.length).toBe(10);

    // Không còn job nào ở trạng thái PENDING
    const pendingJobs = allJobs.filter((j) => j.status === 'PENDING');
    expect(pendingJobs.length).toBe(0);

    // Tất cả 10 jobs đều đã COMPLETED
    const completedJobs = allJobs.filter((j) => j.status === 'COMPLETED');
    expect(completedJobs.length).toBe(10);

    // Xác nhận cả 2 instances đều tham gia xử lý (Horizontal load-sharing)
    const processedByA = allJobs.filter((j) => j.lockedBy === 'INSTANCE_NODE_A');
    const processedByB = allJobs.filter((j) => j.lockedBy === 'INSTANCE_NODE_B');

    expect(processedByA.length).toBeGreaterThan(0);
    expect(processedByB.length).toBeGreaterThan(0);
    expect(processedByA.length + processedByB.length).toBe(10);
  });
});
