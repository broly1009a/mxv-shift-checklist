import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ApiWatcherService {
  private readonly logger = new Logger(ApiWatcherService.name);

  /**
   * Check if HTTP API target condition is met.
   */
  async checkApiTask(target: string, condition: string): Promise<{ success: boolean; message: string }> {
    let url = target;
    let method = 'GET';
    let expectedStatus = 200;

    try {
      const parsedTarget = JSON.parse(target);
      url = parsedTarget.url || target;
      method = parsedTarget.method || 'GET';
      expectedStatus = parsedTarget.status || 200;
    } catch {
      // Treat target as raw URL
    }

    const isSimulation = process.env.SIMULATE_BOT_CHECKS === 'true' || !url.startsWith('http');

    if (isSimulation) {
      this.logger.debug(`[Simulation] Checking mock API for URL: "${url}"`);
      return this.checkMockApi(url, condition);
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Accept': 'application/json' },
      });

      if (res.status !== expectedStatus) {
        return {
          success: false,
          message: `API trả về HTTP status ${res.status} (Kỳ vọng: ${expectedStatus})`,
        };
      }

      if (condition) {
        const bodyText = await res.text();
        let conditionMet = false;
        
        try {
          const resJson = JSON.parse(bodyText);
          const parsedCondition = JSON.parse(condition);

          // Evaluate JSON key-value condition matches (e.g. {"status": "ONLINE"})
          conditionMet = Object.entries(parsedCondition).every(([key, val]) => {
            return resJson[key] === val;
          });
        } catch {
          // Fallback: substring search in raw response body
          conditionMet = bodyText.toLowerCase().includes(condition.toLowerCase());
        }

        if (!conditionMet) {
          return {
            success: false,
            message: `API hoạt động nhưng phản hồi không thỏa mãn điều kiện: "${condition}"`,
          };
        }
      }

      return {
        success: true,
        message: `API hoạt động bình thường tại: ${url} (HTTP ${res.status})`,
      };
    } catch (error: any) {
      this.logger.error(`Error in ApiWatcherService: ${error.message}`);
      return {
        success: false,
        message: `Lỗi kết nối API: ${error.message}`,
      };
    }
  }

  /**
   * Helper to check mock API targets.
   */
  private checkMockApi(url: string, condition: string): { success: boolean; message: string } {
    const mockApis = [
      {
        url: 'http://oms.mxv.vn/api/v1/health',
        status: 200,
        body: { status: 'UP', database: 'CONNECTED' },
      },
      {
        url: 'http://cqg.mxv.vn/api/status',
        status: 200,
        body: { connection: 'ACTIVE', latencyMs: 15 },
      }
    ];

    const match = mockApis.find(api => url.includes(api.url) || api.url.includes(url));

    if (match) {
      if (condition) {
        let conditionMet = false;
        try {
          const parsedCondition = JSON.parse(condition);
          conditionMet = Object.entries(parsedCondition).every(([key, val]) => {
            return (match.body as any)[key] === val;
          });
        } catch {
          conditionMet = JSON.stringify(match.body).toLowerCase().includes(condition.toLowerCase());
        }

        if (!conditionMet) {
          return {
            success: false,
            message: `[Mô Phỏng] Phản hồi API không khớp điều kiện: "${condition}"`,
          };
        }
      }

      return {
        success: true,
        message: `[Mô Phỏng] API trả về: ${JSON.stringify(match.body)} (HTTP ${match.status})`,
      };
    }

    // Default mock response for unregistered endpoints to make testing easy
    return {
      success: true,
      message: `[Mô Phỏng Fallback] API mặc định phản hồi thành công cho: ${url}`,
    };
  }
}
