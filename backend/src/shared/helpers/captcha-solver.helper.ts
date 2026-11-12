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

import * as fs from 'fs';
import * as path from 'path';

export interface CaptchaSolverOptions {
  apiKey?: string;
  models?: string[];
  timeoutMs?: number;
  totalTimeoutMs?: number;
  cacheFilePath?: string;
  logCallback?: (msg: string) => void | Promise<void>;
  prompt?: string;
}

export class CaptchaSolverHelper {
  private static cachedModels: { list: string[]; fetchedAt: number } | null = null;
  private static lastSuccessfulModel: string = '';
  private static readonly modelCooldowns = new Map<string, number>();
  private static readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 giờ
  private static readonly RATE_LIMIT_COOLDOWN_MS = 30 * 60 * 1000; // 30 phút cho 429/404
  private static readonly TRANSIENT_COOLDOWN_MS = 10 * 60 * 1000; // 10 phút cho 503/timeout
  private static readonly DEFAULT_MODEL_CACHE_FILE = path.join(
    process.cwd(),
    'temp',
    'captcha_last_model.txt',
  );

  /**
   * Reset trạng thái in-memory (phục vụ unit test cô lập).
   */
  public static resetStateForTesting(): void {
    this.cachedModels = null;
    this.lastSuccessfulModel = '';
    this.modelCooldowns.clear();
  }

  /**
   * Đọc model thành công gần nhất từ RAM hoặc file cache trên đĩa (bền vững qua PM2 restart).
   */
  public static loadPersistedLastModel(
    cacheFilePath: string = this.DEFAULT_MODEL_CACHE_FILE,
  ): string {
    if (this.lastSuccessfulModel && !this.isModelInCooldown(this.lastSuccessfulModel)) {
      return this.lastSuccessfulModel;
    }
    try {
      if (fs.existsSync(cacheFilePath)) {
        const persisted = fs.readFileSync(cacheFilePath, 'utf8').trim();
        if (persisted && !this.isModelInCooldown(persisted)) {
          this.lastSuccessfulModel = persisted;
          return persisted;
        }
      }
    } catch {
      // Bỏ qua lỗi đọc file cache không nghiêm trọng
    }
    return '';
  }

  /**
   * Lưu model giải thành công xuống RAM và đĩa để tái sử dụng sau khi PM2 restart.
   */
  public static persistLastModel(
    model: string,
    cacheFilePath: string = this.DEFAULT_MODEL_CACHE_FILE,
  ): void {
    const clean = (model || '').trim();
    if (!clean) return;
    this.lastSuccessfulModel = clean;
    this.modelCooldowns.delete(clean);
    try {
      const dir = path.dirname(cacheFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = `${cacheFilePath}.tmp.${process.pid}`;
      try {
        fs.writeFileSync(tmpPath, clean, 'utf8');
        fs.renameSync(tmpPath, cacheFilePath);
      } catch {
        try {
          if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        } catch {}
      }
    } catch {
      // Bỏ qua lỗi ghi file cache không nghiêm trọng
    }
  }

  public static markModelFailed(model: string, statusCode?: number): void {
    const clean = (model || '').trim();
    if (!clean) return;
    const isQuotaOrMissing = statusCode === 429 || statusCode === 404 || statusCode === 400;
    const cooldownMs = isQuotaOrMissing
      ? this.RATE_LIMIT_COOLDOWN_MS
      : this.TRANSIENT_COOLDOWN_MS;
    this.modelCooldowns.set(clean, Date.now() + cooldownMs);
    if (this.lastSuccessfulModel === clean) {
      this.lastSuccessfulModel = '';
    }
  }

  public static isModelInCooldown(model: string, now: number = Date.now()): boolean {
    const until = this.modelCooldowns.get(model);
    if (!until) return false;
    if (now >= until) {
      this.modelCooldowns.delete(model);
      return false;
    }
    return true;
  }

  /**
   * Xếp hạng ưu tiên model:
   * Tier 0: Stable flash-lite (GA) -> Tier 1: Stable flash (GA) -> Tier 2: -latest alias
   * -> Tier 3: Other stable gemini -> Tier 4: omni / preview / exp / alpha / beta (dự phòng cuối cùng).
   */
  public static prioritizeModels(models: string[]): string[] {
    const getTier = (m: string): number => {
      const lower = m.toLowerCase();
      const isExperimental =
        lower.includes('omni') ||
        lower.includes('preview') ||
        lower.includes('-exp') ||
        lower.includes('-alpha') ||
        lower.includes('-beta') ||
        lower.includes('thinking');
      if (isExperimental) return 4;
      if (lower.endsWith('-latest')) return 2;
      if (lower.includes('flash-lite')) return 0;
      if (lower.includes('flash')) return 1;
      return 3;
    };

    return [...models].sort((a, b) => {
      const tierDiff = getTier(a) - getTier(b);
      if (tierDiff !== 0) return tierDiff;
      return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

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
        .filter((m: any) => {
          const nameLower = (m.name || '').toLowerCase();
          return (
            m.supportedGenerationMethods?.includes('generateContent') &&
            !nameLower.includes('tts') &&
            !nameLower.includes('transcribe') &&
            !nameLower.includes('computer-use') &&
            !nameLower.includes('embedding') &&
            !nameLower.includes('robotics') &&
            !nameLower.includes('audio')
          );
        })
        .map((m: any) => m.name.replace(/^models\//, ''));

      const flashModels = contentModels.filter((m: string) => {
        const lower = m.toLowerCase();
        return lower.startsWith('gemini-') && lower.includes('flash') && !lower.includes('image');
      });
      const otherModels = contentModels.filter((m: string) => {
        const lower = m.toLowerCase();
        return lower.startsWith('gemini-') && !lower.includes('flash');
      });

      const sorted = this.prioritizeModels([...flashModels, ...otherModels]);
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

    const perModelTimeoutMs = options?.timeoutMs || 8000;
    const totalTimeoutMs = options?.totalTimeoutMs || 25000;
    const deadlineAt = Date.now() + totalTimeoutMs;
    const cacheFilePath = options?.cacheFilePath || this.DEFAULT_MODEL_CACHE_FILE;

    // Lấy danh sách candidate models (tính cả thời gian fetch discovery vào tổng ngân sách totalTimeoutMs)
    const hasExplicitModels = Array.isArray(options?.models) && options.models.length > 0;
    let dynamicModels = hasExplicitModels ? [...options!.models!] : [];
    if (dynamicModels.length === 0) {
      dynamicModels = await this.getAvailableModels(apiKey);
    } else {
      dynamicModels = this.prioritizeModels(dynamicModels);
    }

    const baseCandidates =
      dynamicModels.length > 0
        ? dynamicModels.slice(0, 12)
        : this.prioritizeModels([
            'gemini-3.5-flash-lite',
            'gemini-2.5-flash-lite',
            'gemini-2.5-flash',
            'gemini-2.0-flash-lite',
            'gemini-2.0-flash',
            'gemini-1.5-flash',
            'gemini-3.5-flash',
            'gemini-flash-latest',
          ]);

    // Ưu tiên model thành công gần nhất (Last-Known-Good từ RAM hoặc đĩa) lên vị trí đầu tiên
    const lastGoodModel = this.loadPersistedLastModel(cacheFilePath);
    let orderedCandidates = baseCandidates;
    if (lastGoodModel && (!hasExplicitModels || baseCandidates.includes(lastGoodModel))) {
      orderedCandidates = [
        lastGoodModel,
        ...baseCandidates.filter((m) => m !== lastGoodModel),
      ];
    }

    // Lọc bỏ các model đang trong cooldown (429/503/timeout); chỉ dùng lại nếu tất cả đều đang cooldown
    const now = Date.now();
    const readyCandidates = orderedCandidates.filter((m) => !this.isModelInCooldown(m, now));
    const candidateModels =
      readyCandidates.length > 0
        ? readyCandidates
        : [...orderedCandidates].sort(
            (a, b) => (this.modelCooldowns.get(a) || 0) - (this.modelCooldowns.get(b) || 0),
          );

    const promptText =
      options?.prompt ||
      'Read the characters in this image. It is a captcha code. Output ONLY the raw characters (case-sensitive, no spaces, no punctuation, no bold, no explanation). Example output: EBGPG';

    for (const model of candidateModels) {
      const remainingMs = deadlineAt - Date.now();
      if (remainingMs <= 0) {
        await log(`[CaptchaSolver] Đã chạm giới hạn thời gian tổng (${totalTimeoutMs}ms), dừng thử thêm model.`);
        break;
      }
      const effectiveTimeoutMs = Math.max(500, Math.min(perModelTimeoutMs, remainingMs));

      try {
        await log(`[CaptchaSolver] Đang gửi ảnh Captcha tới Google Gemini (${model})...`);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            signal: AbortSignal.timeout(effectiveTimeoutMs),
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
          this.markModelFailed(model, response.status);
          const errText = await response.text().catch(() => '');
          await log(`[CaptchaSolver] Model ${model} HTTP ${response.status} (${errText.substring(0, 80)}). Đưa vào cooldown & thử model tiếp theo...`);
          continue;
        }

        const data: any = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        const solvedCode = text ? text.replace(/[\s\r\n`"']/g, '').trim() : '';

        if (solvedCode) {
          this.persistLastModel(model, cacheFilePath);
          await log(`[CaptchaSolver]  Giải Captcha thành công bằng model (${model}): "${solvedCode}"`);
          return solvedCode;
        }
        this.markModelFailed(model);
      } catch (err: any) {
        this.markModelFailed(model);
        await log(`[CaptchaSolver] Lỗi khi gọi model ${model}: ${err.message}. Đưa vào cooldown & thử model kế tiếp...`);
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
