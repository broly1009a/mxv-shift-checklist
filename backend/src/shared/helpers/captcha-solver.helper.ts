/**
 * CaptchaSolverHelper - Enterprise AI Captcha Solver for MXV Ecosystem
 * 
 * Đóng gói toàn bộ logic giải mã Captcha hình ảnh qua Google Gemini AI:
 * - Hỗ trợ nhận Buffer hoặc chuỗi Base64
 * - Tự động phát hiện Gemini API Key từ tham số, biến môi trường (GEMINI_API_KEY, GOOGLE_API_KEY)
 * - Tự động tra cứu danh sách Model Gemini đang hoạt động (Dynamic Model Discovery)
 * - Cơ chế Last-Known-Good Model ưu tiên model giải nhanh và thành công nhất (0-2s)
 * - Tự động làm sạch kết quả, lọc bỏ ký tự rác/khoảng trắng
 * - Hoàn toàn độc lập (Zero Browser / Pure HTTP), dùng chung cho toàn bộ các module trong hệ thống
 */

export interface CaptchaSolverOptions {
  apiKey?: string;
  models?: string[];
  timeoutMs?: number;
  logCallback?: (msg: string) => void | Promise<void>;
  prompt?: string;
}

export class CaptchaSolverHelper {
  private static cachedModels: { list: string[]; fetchedAt: number } | null = null;
  private static lastSuccessfulModel: string = '';
  private static readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 giờ

  /**
   * Lấy danh sách các model Gemini đang hoạt động trực tiếp từ Google API
   */
  public static async getAvailableModels(apiKey: string): Promise<string[]> {
    if (!apiKey) return [];
    const now = Date.now();

    if (
      this.cachedModels &&
      now - this.cachedModels.fetchedAt < this.CACHE_TTL_MS &&
      this.cachedModels.list.length > 0
    ) {
      return this.cachedModels.list;
    }

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) return [];
      const data: any = await res.json();
      const contentModels = (data.models || [])
        .filter(
          (m: any) =>
            m.supportedGenerationMethods?.includes('generateContent') &&
            !m.name?.includes('tts') &&
            !m.name?.includes('transcribe') &&
            !m.name?.includes('computer-use'),
        )
        .map((m: any) => m.name.replace(/^models\//, ''));

      const flashModels = contentModels.filter(
        (m: string) => m.includes('flash') && !m.includes('image'),
      );
      const otherModels = contentModels.filter(
        (m: string) => !m.includes('flash') && m.startsWith('gemini-'),
      );

      const prioritizeModels = (models: string[]) => {
        return models.sort((a, b) => {
          const isLatestAliasA = a.endsWith('-latest');
          const isLatestAliasB = b.endsWith('-latest');
          if (isLatestAliasA !== isLatestAliasB) return isLatestAliasA ? 1 : -1;
          return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });
        });
      };

      const sortedFlash = prioritizeModels(flashModels);
      const sorted = [...sortedFlash, ...otherModels];
      if (sorted.length > 0) {
        this.cachedModels = { list: sorted, fetchedAt: now };
        return sorted;
      }
    } catch {
      // Fallback danh sách mặc định nếu mạng ngoài Google bị chặn
    }
    return [];
  }

  /**
   * Giải mã ảnh Captcha (Buffer hoặc Base64 string)
   */
  public static async solve(
    image: Buffer | string,
    options?: CaptchaSolverOptions,
  ): Promise<string> {
    const apiKey =
      options?.apiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      '';

    if (!apiKey) {
      if (options?.logCallback) {
        await options.logCallback(' CaptchaSolver: Không tìm thấy Gemini API Key. Bỏ qua giải Captcha AI.');
      }
      return '';
    }

    let base64Data: string;
    if (Buffer.isBuffer(image)) {
      base64Data = image.toString('base64');
    } else {
      // Làm sạch prefix data:image/...;base64, nếu có
      base64Data = image.replace(/^data:image\/[a-zA-Z]+;base64,/, '').trim();
    }

    if (!base64Data) return '';

    const log = async (msg: string) => {
      if (options?.logCallback) {
        await options.logCallback(msg);
      }
    };

    // Lấy danh sách candidate models
    let dynamicModels = options?.models || [];
    if (dynamicModels.length === 0) {
      dynamicModels = await this.getAvailableModels(apiKey);
    }

    let candidateModels =
      dynamicModels.length > 0
        ? dynamicModels.slice(0, 10)
        : [
            'gemini-2.5-flash',
            'gemini-2.5-flash-lite',
            'gemini-1.5-flash',
            'gemini-3.5-flash-lite',
            'gemini-3.5-flash',
            'gemini-3.8-flash',
            'gemini-3.7-flash',
            'gemini-3.6-flash',
            'gemini-flash-latest',
          ];

    // Ưu tiên model thành công gần nhất (Last-Known-Good) lên vị trí đầu tiên
    if (this.lastSuccessfulModel) {
      candidateModels = [
        this.lastSuccessfulModel,
        ...candidateModels.filter((m) => m !== this.lastSuccessfulModel),
      ];
    }

    const timeoutMs = options?.timeoutMs || 8000;
    const promptText =
      options?.prompt ||
      'Read the characters in this image. It is a captcha code. Output ONLY the raw characters (case-sensitive, no spaces, no punctuation, no bold, no explanation). Example output: EBGPG';

    for (const model of candidateModels) {
      try {
        await log(`[CaptchaSolver] Đang gửi ảnh Captcha tới Google Gemini (${model})...`);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            signal: AbortSignal.timeout(timeoutMs),
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: promptText },
                    {
                      inlineData: {
                        mimeType: 'image/png',
                        data: base64Data,
                      },
                    },
                  ],
                },
              ],
            }),
          },
        );

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          await log(`[CaptchaSolver] Model ${model} HTTP ${response.status} (${errText.substring(0, 80)}). Thử model tiếp theo...`);
          continue;
        }

        const data: any = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        const solvedCode = text ? text.replace(/[\s\r\n`"']/g, '').trim() : '';

        if (solvedCode) {
          this.lastSuccessfulModel = model;
          await log(`[CaptchaSolver]  Giải Captcha thành công bằng model (${model}): "${solvedCode}"`);
          return solvedCode;
        }
      } catch (err: any) {
        await log(`[CaptchaSolver] Lỗi khi gọi model ${model}: ${err.message}. Thử model kế tiếp...`);
        continue;
      }
    }

    await log(' [CaptchaSolver] Đã thử toàn bộ danh sách Gemini models nhưng không có kết quả.');
    return '';
  }
}

/**
 * Shorthand helper function
 */
export async function solveCaptchaWithAi(
  image: Buffer | string,
  options?: CaptchaSolverOptions,
): Promise<string> {
  return CaptchaSolverHelper.solve(image, options);
}
