/**
 * AI RESCUE PIPELINE & TELEMETRY LOGGER FOR UNSUPPORTED / SCANNED PDFS
 * 
 * Lớp cứu hộ AI Multimodal (Gemini) dành cho các file PDF hợp đồng scan ảnh
 * mà các thuật toán Regex/Rule và OCR cục bộ không bóc tách được trường CCCD.
 * Đồng thời tự động lưu trữ file PDF và metadata vào kho Telemetry để tinh chỉnh
 * mã nguồn và huấn luyện mô hình.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

export interface AiRescueInput {
  accountCode: string;
  pdfPath: string;
  accountName?: string;
  geminiKey?: string;
}

export interface AiRescueResult {
  hoVaTen?: string;
  soCCCD?: string;
  rawNgaySinh?: string;
  rawNgayCap?: string;
  noiCap?: string;
  gioiTinh?: string;
  soHopDong?: string;
  ngayKyHD?: string;
  source: 'GEMINI_PDF_RESCUE';
  modelUsed?: string;
}

/**
 * Tìm kiếm danh sách Gemini API Keys từ biến môi trường hoặc tham số
 * Hỗ trợ danh sách nhiều Key phân cách bằng dấu phẩy ',' hoặc ';' để xoay vòng
 */
export function resolveGeminiKeys(explicitKey?: string): string[] {
  const rawList = [
    explicitKey,
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
  ].filter(Boolean) as string[];

  const keys: string[] = [];
  for (const raw of rawList) {
    for (const part of raw.split(/[,;\n\r]+/)) {
      const k = part.trim();
      if (k && !keys.includes(k)) {
        keys.push(k);
      }
    }
  }
  return keys;
}

/**
 * Ghi log Telemetry phục vụ phân tích mẫu PDF chưa hỗ trợ
 */
export function recordPdfTelemetry(
  accountCode: string,
  pdfPath: string,
  meta: Record<string, any>,
): string {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const telemetryDir = path.resolve(process.cwd(), 'data', 'telemetry_unsupported_pdfs', todayStr, accountCode);
    if (!fs.existsSync(telemetryDir)) {
      fs.mkdirSync(telemetryDir, { recursive: true });
    }

    // Sao lưu file PDF vào kho telemetry
    if (fs.existsSync(pdfPath)) {
      const targetPdfPath = path.join(telemetryDir, `${accountCode}_contract.pdf`);
      if (!fs.existsSync(targetPdfPath)) {
        fs.copyFileSync(pdfPath, targetPdfPath);
      }
    }

    // Ghi file metadata
    const metaPath = path.join(telemetryDir, 'telemetry_meta.json');
    const existingMeta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
    const mergedMeta = {
      ...existingMeta,
      ...meta,
      accountCode,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(metaPath, JSON.stringify(mergedMeta, null, 2), 'utf8');
    return telemetryDir;
  } catch (err: any) {
    console.warn(`[AI-RESCUE-TELEMETRY] Lỗi ghi log telemetry cho ${accountCode}:`, err?.message);
    return '';
  }
}

/**
 * Bộ nhớ đệm lưu lại Key và Model gọi thành công gần nhất (Sticky Last-Known-Good)
 * và danh sách Model được nạp động từ Google API (Zero Hardcode)
 */
interface StickyRescueState {
  lastSuccessfulKeyIndex: number;
  lastSuccessfulModel: string;
  dynamicModels: string[];
  lastModelFetchAt: number;
}

const stickyState: StickyRescueState = {
  lastSuccessfulKeyIndex: 0,
  lastSuccessfulModel: '',
  dynamicModels: [],
  lastModelFetchAt: 0,
};

/**
 * Lấy danh sách model ưu tiên do Quản trị viên cấu hình qua biến môi trường (Configuration-First)
 */
function getConfiguredPreferredModels(): string[] {
  const envVal = process.env.GEMINI_PREFERRED_MODELS || '';
  return envVal
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Tự động truy vấn danh sách model mới nhất từ Google Gemini API (Zero Hardcode 100%)
 * Sắp xếp động hoàn toàn dựa trên Metadata năng lực, tiền tố/hậu tố chính thức và cấu hình môi trường
 */
async function fetchRemoteGeminiModels(apiKey: string): Promise<string[]> {
  if (!apiKey) return [];
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const rawData = await new Promise<string>((resolve, reject) => {
      const parsedUrl = new URL(url);
      const req = https.request(
        {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'GET',
          headers: { 'User-Agent': 'MXV-TKGD-Rescue/1.0' },
          timeout: 8000,
        },
        (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(body);
            } else {
              reject(new Error(`Fetch models HTTP ${res.statusCode}`));
            }
          });
        },
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout fetch models'));
      });
      req.end();
    });

    const json = JSON.parse(rawData);
    const rawModels: any[] = json?.models || [];
    const validModels: string[] = [];

    for (const m of rawModels) {
      const methods: string[] = m.supportedGenerationMethods || [];
      const name: string = String(m.name || '').replace(/^models\//, '');
      if (
        methods.includes('generateContent') &&
        !['tts', 'transcribe', 'computer-use', 'embedding', 'image', 'omni', 'preview', 'audio'].some((x) => name.includes(x))
      ) {
        validModels.push(name);
      }
    }

    const configuredPreferred = getConfiguredPreferredModels();

    // Thuật toán chấm điểm xếp hạng ĐỘNG 100% dựa trên năng lực (Zero Hardcode):
    // 1. Ưu tiên cao nhất: Model được cấu hình trực tiếp trong .env (GEMINI_PREFERRED_MODELS)
    // 2. Ưu tiên Production Pointer (-latest): Google tự động điều hướng tới bản mới & ổn định nhất
    // 3. Ưu tiên dòng Flash: Tối ưu cho tài liệu văn bản, quota rộng và độ trễ thấp
    // 4. Ưu tiên phiên bản số cao hơn: Tự động trích xuất số version bằng regex
    const scoreModel = (name: string): number => {
      let score = 0;
      const envIdx = configuredPreferred.indexOf(name);
      if (envIdx !== -1) {
        score += 1000 - envIdx * 10;
      }
      if (name.endsWith('-latest')) {
        score += 500;
      }
      if (name.includes('flash')) {
        score += 200;
      }
      if (name.includes('preview') || name.includes('exp') || name.includes('experimental')) {
        score -= 300;
      }
      const verMatch = name.match(/(\d+)\.(\d+)/);
      if (verMatch) {
        const verNum = parseFloat(`${verMatch[1]}.${verMatch[2]}`);
        score += Math.round(verNum * 10);
      }
      return score;
    };

    return [...validModels].sort((a, b) => scoreModel(b) - scoreModel(a));
  } catch (err: any) {
    console.warn(`[AI-RESCUE] Không thể truy vấn danh sách model động: ${err?.message}`);
    return getConfiguredPreferredModels();
  }
}

/**
 * Gọi Google Gemini Multimodal API với inlineData PDF
 * Hỗ trợ xoay vòng đa API Key và đa Model (Dual-Layer Failover)
 * Tự động đồng bộ danh sách Model từ Google API và ghi nhớ Key/Model thành công gần nhất
 */
async function callGeminiPdfApi(
  pdfBuffer: Buffer,
  apiKeys: string[],
  accountName?: string,
): Promise<{ data: Partial<AiRescueResult> | null; modelUsed: string; rawText: string }> {
  // 1. Tự động lấy danh sách Model động từ Google API (lưu cache trong 1 giờ)
  const now = Date.now();
  if (stickyState.dynamicModels.length === 0 || now - stickyState.lastModelFetchAt > 60 * 60 * 1000) {
    const fetched = await fetchRemoteGeminiModels(apiKeys[0]);
    if (fetched && fetched.length > 0) {
      stickyState.dynamicModels = fetched;
      stickyState.lastModelFetchAt = now;
      console.log(`[AI-RESCUE] Đã tự động đồng bộ ${fetched.length} model từ Google API. Ưu tiên: ${fetched.slice(0, 3).join(', ')}...`);
    }
  }

  // 2. Danh sách Model ứng viên (Động 100% từ Google API, fallback qua biến môi trường)
  const baseModels = stickyState.dynamicModels.length > 0
    ? stickyState.dynamicModels
    : getConfiguredPreferredModels();

  // 3. Ưu tiên model thành công gần nhất (Sticky Last-Known-Good) lên đầu danh sách
  const candidateModels = stickyState.lastSuccessfulModel && baseModels.includes(stickyState.lastSuccessfulModel)
    ? [stickyState.lastSuccessfulModel, ...baseModels.filter((m) => m !== stickyState.lastSuccessfulModel)]
    : baseModels;

  const base64Data = pdfBuffer.toString('base64');
  const promptText = `Bạn là chuyên gia thẩm định tài liệu mở tài khoản giao dịch hàng hóa tại Sở Giao dịch Hàng hóa Việt Nam (MXV).
Dưới đây là file PDF hợp đồng mở tài khoản giao dịch ${accountName ? `của khách hàng ${accountName}` : ''}.
Hãy đọc toàn bộ tài liệu (đặc biệt là trang đầu tiên chứa thông tin cá nhân khách hàng) và bóc tách các trường sau dưới dạng JSON chuẩn:
{
  "hoVaTen": "Họ và tên khách hàng (chữ in HOA đầy đủ tiếng Việt)",
  "soCCCD": "Số Căn cước công dân hoặc CMND hoặc Hộ chiếu (chuỗi số 12 chữ số hoặc 9 chữ số)",
  "rawNgaySinh": "Ngày sinh định dạng DD/MM/YYYY",
  "rawNgayCap": "Ngày cấp CCCD định dạng DD/MM/YYYY",
  "noiCap": "Nơi cấp CCCD (ví dụ: BỘ CÔNG AN hoặc CỤC CẢNH SÁT...)",
  "gioiTinh": "Nam hoặc Nữ",
  "soHopDong": "Số hợp đồng mở tài khoản",
  "ngayKyHD": "Ngày ký hợp đồng DD/MM/YYYY"
}
Yêu cầu bắt buộc:
1. Nếu phát hiện số CCCD (12 chữ số hoặc 9 chữ số), bắt buộc trích xuất chính xác vào trường "soCCCD".
2. Chỉ trả về duy nhất 1 JSON object hợp lệ, không bọc trong markdown code block rườm rà.`;

  // Bắt đầu thử từ Key thành công gần nhất (Sticky Key Rotation)
  const safeStartIndex = stickyState.lastSuccessfulKeyIndex % apiKeys.length;
  const keyOrder = Array.from({ length: apiKeys.length }, (_, i) => (i + safeStartIndex) % apiKeys.length);

  for (const keyIdx of keyOrder) {
    const apiKey = apiKeys[keyIdx];
    const keyLabel = `Key #${keyIdx + 1} (${apiKey.slice(0, 8)}...${apiKey.slice(-4)})`;

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload = JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: 'application/pdf',
                    data: base64Data,
                  },
                },
                {
                  text: promptText,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        });

        const responseText = await new Promise<string>((resolve, reject) => {
          const parsedUrl = new URL(url);
          const req = https.request(
            {
              hostname: parsedUrl.hostname,
              path: parsedUrl.pathname + parsedUrl.search,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              },
              timeout: 30000,
            },
            (res) => {
              let body = '';
              res.setEncoding('utf8');
              res.on('data', (chunk) => (body += chunk));
              res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                  resolve(body);
                } else {
                  const errObj: any = new Error(`Gemini HTTP ${res.statusCode}: ${body.slice(0, 200)}`);
                  errObj.statusCode = res.statusCode;
                  reject(errObj);
                }
              });
            },
          );

          req.on('error', reject);
          req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Timeout gọi Gemini model ${model}`));
          });
          req.write(payload);
          req.end();
        });

        const jsonRes = JSON.parse(responseText);
        const textCandidate = jsonRes?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textCandidate) continue;

        let parsedData: any = null;
        try {
          parsedData = JSON.parse(textCandidate.trim().replace(/^```json/i, '').replace(/```$/i, ''));
        } catch {
          const jsonMatch = textCandidate.match(/\{[\s\S]*\}/);
          if (jsonMatch) parsedData = JSON.parse(jsonMatch[0]);
        }

        if (parsedData && (parsedData.soCCCD || parsedData.hoVaTen)) {
          // Lưu lại Key & Model thành công gần nhất vào bộ nhớ đệm
          stickyState.lastSuccessfulKeyIndex = keyIdx;
          stickyState.lastSuccessfulModel = model;
          return {
            data: parsedData,
            modelUsed: `${model} (${keyLabel})`,
            rawText: textCandidate,
          };
        }
      } catch (err: any) {
        // Nếu dính lỗi từ chối truy cập (403) hoặc cạn kiệt Quota / Rate Limit (429), chuyển ngay sang Key tiếp theo!
        if (err?.statusCode === 403 || err?.statusCode === 429) {
          console.warn(`[AI-RESCUE] ${keyLabel} gặp lỗi HTTP ${err?.statusCode} (${err?.statusCode === 429 ? 'Hết Quota/Rate Limit' : 'Bị từ chối'}). Tự động xoay vòng sang API Key tiếp theo...`);
          stickyState.lastSuccessfulKeyIndex = (keyIdx + 1) % apiKeys.length;
          break; // Thoát model loop của key này để thử key tiếp theo ngay lập tức
        }
        console.warn(`[AI-RESCUE] ${keyLabel} - Model ${model} không thành công (HTTP ${err?.statusCode || 'Lỗi'}): ${err?.message?.slice(0, 100)}`);
      }
    }
  }

  return { data: null, modelUsed: '', rawText: '' };
}


/**
 * Hàm cứu hộ chính: Gọi AI Multimodal bóc tách PDF và tự động lưu Telemetry
 */
export async function rescuePdfWithGeminiAi(input: AiRescueInput): Promise<AiRescueResult | null> {
  const { accountCode, pdfPath, accountName } = input;
  if (!fs.existsSync(pdfPath)) return null;

  const apiKeys = resolveGeminiKeys(input.geminiKey);
  const pdfBuffer = fs.readFileSync(pdfPath);

  // Nếu không có API Key, ghi nhận telemetry để con người phân tích sau
  if (apiKeys.length === 0) {
    recordPdfTelemetry(accountCode, pdfPath, {
      status: 'PENDING_NO_API_KEY',
      fileSize: pdfBuffer.length,
      reason: 'Chưa cấu hình GEMINI_API_KEY để gọi AI Rescue Pipeline',
    });
    return null;
  }

  const { data, modelUsed, rawText } = await callGeminiPdfApi(pdfBuffer, apiKeys, accountName);

  // Ghi nhận telemetry kết quả bóc tách
  recordPdfTelemetry(accountCode, pdfPath, {
    status: data?.soCCCD ? 'SUCCESS_RESCUED' : 'FAILED_EXTRACTION',
    modelUsed,
    fileSize: pdfBuffer.length,
    extractedData: data,
    rawAiResponse: rawText,
  });

  if (!data) return null;

  const cleanedCccd = (data.soCCCD || '').replace(/\D/g, '');
  return {
    hoVaTen: data.hoVaTen ? String(data.hoVaTen).trim().toUpperCase() : undefined,
    soCCCD: cleanedCccd.length >= 9 ? cleanedCccd : undefined,
    rawNgaySinh: data.rawNgaySinh,
    rawNgayCap: data.rawNgayCap,
    noiCap: data.noiCap,
    gioiTinh: data.gioiTinh,
    soHopDong: data.soHopDong,
    ngayKyHD: data.ngayKyHD,
    source: 'GEMINI_PDF_RESCUE',
    modelUsed,
  };
}

/**
 * Phân loại thị giác cho file PDF scan ảnh thuần (không có text layer) bằng Gemini Vision
 */
export async function classifyScannedPdfWithGemini(
  pdfBufferOrPath: string | Buffer,
  explicitKey?: string,
): Promise<'HOP_DONG' | 'PHU_LUC' | 'CCCD_SCAN' | 'UNKNOWN'> {
  let pdfBuffer: Buffer;
  if (typeof pdfBufferOrPath === 'string') {
    if (!fs.existsSync(pdfBufferOrPath)) return 'UNKNOWN';
    pdfBuffer = fs.readFileSync(pdfBufferOrPath);
  } else if (Buffer.isBuffer(pdfBufferOrPath)) {
    pdfBuffer = pdfBufferOrPath;
  } else {
    return 'UNKNOWN';
  }

  const apiKeys = resolveGeminiKeys(explicitKey);
  if (apiKeys.length === 0) return 'UNKNOWN';

  const base64Data = pdfBuffer.toString('base64');
  // 1. Tự động lấy danh sách Model động từ Google API (lưu cache trong 1 giờ)
  const now = Date.now();
  if (stickyState.dynamicModels.length === 0 || now - stickyState.lastModelFetchAt > 60 * 60 * 1000) {
    const fetched = await fetchRemoteGeminiModels(apiKeys[0]);
    if (fetched && fetched.length > 0) {
      stickyState.dynamicModels = fetched;
      stickyState.lastModelFetchAt = now;
    }
  }

  const baseModels = stickyState.dynamicModels.length > 0
    ? stickyState.dynamicModels
    : getConfiguredPreferredModels();

  const candidateModels = stickyState.lastSuccessfulModel && baseModels.includes(stickyState.lastSuccessfulModel)
    ? [stickyState.lastSuccessfulModel, ...baseModels.filter((m) => m !== stickyState.lastSuccessfulModel)]
    : baseModels;

  const promptText = `Hãy nhìn vào trang đầu tiên của tài liệu PDF này và phân loại loại tài liệu:
1. "HOP_DONG": Nếu là Hợp đồng mở tài khoản giao dịch, Hợp đồng dịch vụ, Giấy đề nghị mở tài khoản giao dịch hàng hóa.
2. "PHU_LUC": Nếu là Phụ lục hợp đồng, Phụ lục số 01, Giấy đề nghị mở tiểu khoản (ACM/CQG/Straits), Giấy đăng ký giao dịch liên thông.
3. "CCCD_SCAN": Nếu là bản chụp scan giấy tờ tùy thân (Căn cước công dân, Chứng minh nhân dân, Hộ chiếu).
4. "UNKNOWN": Nếu không thuộc các loại trên.

Trả về DUY NHẤT một JSON hợp lệ: {"docType": "HOP_DONG" | "PHU_LUC" | "CCCD_SCAN" | "UNKNOWN"}`;

  for (const apiKey of apiKeys) {
    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload = JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: 'application/pdf',
                    data: base64Data,
                  },
                },
                { text: promptText },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        });

        const responseText = await new Promise<string>((resolve, reject) => {
          const parsedUrl = new URL(url);
          const req = https.request(
            {
              hostname: parsedUrl.hostname,
              path: parsedUrl.pathname + parsedUrl.search,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              },
              timeout: 15000,
            },
            (res) => {
              let body = '';
              res.setEncoding('utf8');
              res.on('data', (chunk) => (body += chunk));
              res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                  resolve(body);
                } else {
                  const errObj: any = new Error(`HTTP ${res.statusCode}`);
                  errObj.statusCode = res.statusCode;
                  reject(errObj);
                }
              });
            },
          );
          req.on('error', reject);
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
          });
          req.write(payload);
          req.end();
        });

        const jsonRes = JSON.parse(responseText);
        const textCandidate = jsonRes?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textCandidate) continue;

        let parsed: any = null;
        try {
          parsed = JSON.parse(textCandidate.trim().replace(/^```json/i, '').replace(/```$/i, ''));
        } catch {
          const m = textCandidate.match(/\{[\s\S]*\}/);
          if (m) parsed = JSON.parse(m[0]);
        }

        const docType = parsed?.docType?.toUpperCase();
        if (docType === 'HOP_DONG' || docType === 'PHU_LUC' || docType === 'CCCD_SCAN') {
          stickyState.lastSuccessfulModel = model;
          return docType;
        }
      } catch (err: any) {
        if (err?.statusCode === 403 || err?.statusCode === 429) {
          console.warn(`[AI-PDF-CLASSIFY] Key gặp lỗi HTTP ${err?.statusCode} (${err?.statusCode === 429 ? 'Hết Quota/Rate Limit' : 'Bị từ chối'}). Tự động xoay vòng sang Key tiếp theo...`);
          break; // Thoát model loop để thử apiKey tiếp theo ngay lập tức
        }
        console.warn(`[AI-PDF-CLASSIFY] Thử model ${model} thất bại: ${err?.message || err}`);
      }
    }
  }

  return 'UNKNOWN';
}

