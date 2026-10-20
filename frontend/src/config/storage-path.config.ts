/**
 * Cấu hình tập trung ánh xạ đường dẫn lưu trữ đa nền tảng (Storage Path Mapping Configuration)
 * 
 * Mục tiêu kiến trúc (Rule 7 - Zero-Hardcoding & Data-Driven Architecture):
 * - Tập trung hóa toàn bộ prefix mount của các môi trường (Windows Drive M:, Linux Mount /mnt/qlgd-it, UNC Share)
 *   vào DUY NHẤT một file cấu hình này thay vì rải rác trong từng component UI.
 * - Hỗ trợ ghi đè linh hoạt qua biến môi trường (.env) khi chuyển đổi hạ tầng / máy chủ.
 * - Khi MXV đổi tên ổ mạng, thư mục mount hoặc IP server, CHỈ CẦN SỬA DUY NHẤT FILE NÀY.
 */

export interface StorageMountConfig {
  /** Tiền tố ổ mạng dùng chung trên Windows (Mặc định: M:\Tailieuchung\QLGD-IT) */
  windowsSharePrefix: string;
  /** Tiền tố mount trên máy chủ Linux/Ubuntu (Mặc định: /mnt/qlgd-it) */
  linuxMountPrefix: string;
  /** Tên thư mục gốc dữ liệu (Mặc định: Quanlygiaodich) */
  rootFolderName: string;
  /** Danh sách các tiền tố mount Linux đã biết để bóc tách */
  knownLinuxMounts: string[];
  /** Danh sách các tiền tố UNC share đã biết (không phân biệt hoa thường) */
  knownUncShares: string[];
}

export const STORAGE_MOUNT_CONFIG: StorageMountConfig = {
  windowsSharePrefix:
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_STORAGE_SHARE_WINDOWS) ||
    'M:\\Tailieuchung\\QLGD-IT',
  linuxMountPrefix:
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_STORAGE_MOUNT_LINUX) ||
    '/mnt/qlgd-it',
  rootFolderName: 'Quanlygiaodich',
  knownLinuxMounts: ['/mnt/qlgd-it', '/mnt/oc-uat', '/mnt/share'],
  knownUncShares: ['tailieuchung/qlgd-it', 'tailieuchung'],
};

export interface SmartPathPreset {
  name: string;
  path: string;
  description?: string;
}

/**
 * Danh mục Presets mẫu được tạo động từ tiền tố cấu hình
 */
export const DEFAULT_STORAGE_PRESETS: SmartPathPreset[] = [
  {
    name: 'MS Futures',
    path: `${STORAGE_MOUNT_CONFIG.windowsSharePrefix}\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures\\\${YYYY}\\T\${MM}.\${YYYY}\\\${DD}.\${MM}`,
    description: 'Thư mục sao lưu M-System Futures theo ngày',
  },
  {
    name: 'MS ACM',
    path: `${STORAGE_MOUNT_CONFIG.windowsSharePrefix}\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\ACM\\\${YYYY}\\T\${MM}.\${YYYY}\\\${DD}.\${MM}`,
    description: 'Thư mục sao lưu M-System ACM theo ngày',
  },
  {
    name: 'CQG Futures',
    path: `${STORAGE_MOUNT_CONFIG.windowsSharePrefix}\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures\\\${YYYY}\\T\${MM}.\${YYYY}\\\${DD}.\${MM}`,
    description: 'Thư mục sao lưu CQG Futures theo ngày',
  },
  {
    name: 'TradingCheck Futures',
    path: `${STORAGE_MOUNT_CONFIG.windowsSharePrefix}\\Quanlygiaodich\\Tai lieu hoat dong\\TradingCheck\\Futures`,
    description: 'Thư mục chứa dữ liệu kiểm tra khớp lệnh trong phiên',
  },
  {
    name: 'Kết quả Check KLGD',
    path: `${STORAGE_MOUNT_CONFIG.windowsSharePrefix}\\Quanlygiaodich\\Tai lieu hoat dong\\TradingCheck\\Ket qua check KLGD`,
    description: 'Thư mục lưu log và kết quả đối soát KLGD',
  },
];

/**
 * Bóc tách phần đường dẫn tương đối (từ Quanlygiaodich trở đi)
 * Hoàn toàn động (Data-Driven), không phỏng đoán từ khóa hay sửa đổi tên nghiệp vụ
 */
export function extractRelativeSubPath(rawPath: string): string {
  if (!rawPath || !rawPath.trim()) return '';

  const normalizedSlash = rawPath.trim().replace(/\\/g, '/');

  // 1. Nhận diện trực tiếp từ thư mục gốc Quanlygiaodich/...
  const rootRegex = new RegExp(`(?:^|\\/)(${STORAGE_MOUNT_CONFIG.rootFolderName}\\/.*)$`, 'i');
  const rootMatch = normalizedSlash.match(rootRegex);
  if (rootMatch) {
    return rootMatch[1];
  }

  // 2. Nhận diện qua tiền tố ổ Windows có Tailieuchung (ví dụ M:/tailieuchung/qlgd-it/...)
  for (const unc of STORAGE_MOUNT_CONFIG.knownUncShares) {
    const driveRegex = new RegExp(`^[a-zA-Z]:\\/${unc}\\/(.*)$`, 'i');
    const driveMatch = normalizedSlash.match(driveRegex);
    if (driveMatch) {
      const rest = driveMatch[1];
      return rest.toLowerCase().startsWith(`${STORAGE_MOUNT_CONFIG.rootFolderName.toLowerCase()}/`)
        ? rest
        : `${STORAGE_MOUNT_CONFIG.rootFolderName}/${rest}`;
    }
  }

  // 3. Nhận diện qua UNC Path mạng (ví dụ //10.0.0.x/tailieuchung/qlgd-it/...)
  const uncPrefixRegex = new RegExp(`^\\/\\/[^/]+\\/(?:${STORAGE_MOUNT_CONFIG.knownUncShares.join('|')})\\/?(.*)$`, 'i');
  const uncMatch = normalizedSlash.match(uncPrefixRegex);
  if (uncMatch) {
    const rest = uncMatch[1];
    return rest.toLowerCase().startsWith(`${STORAGE_MOUNT_CONFIG.rootFolderName.toLowerCase()}/`)
      ? rest
      : `${STORAGE_MOUNT_CONFIG.rootFolderName}/${rest}`;
  }

  // 4. Nhận diện qua các điểm mount Linux đã biết (ví dụ /mnt/qlgd-it/...)
  for (const mountPrefix of STORAGE_MOUNT_CONFIG.knownLinuxMounts) {
    const mountSlash = mountPrefix.replace(/\\/g, '/').toLowerCase();
    if (normalizedSlash.toLowerCase().startsWith(mountSlash)) {
      const rest = normalizedSlash.slice(mountSlash.length).replace(/^\/+/, '');
      return rest.toLowerCase().startsWith(`${STORAGE_MOUNT_CONFIG.rootFolderName.toLowerCase()}/`)
        ? rest
        : `${STORAGE_MOUNT_CONFIG.rootFolderName}/${rest}`;
    }
  }

  return '';
}

/**
 * Chuẩn hóa và chuyển đổi đường dẫn sang dạng ổ mạng dùng chung Windows
 */
export function parseWindowsStoragePath(rawPath: string) {
  if (!rawPath || !rawPath.trim()) {
    return null;
  }

  const trimmed = rawPath.trim();
  let subPath = extractRelativeSubPath(trimmed);

  // Nếu không nhận diện được cấu trúc mount của hệ thống, giữ nguyên 100% đường dẫn gốc
  if (!subPath) {
    const hasDynamic = trimmed.includes('${');
    return {
      hasConversionDiff: false,
      hasDynamicVars: hasDynamic,
      suggestedPath: trimmed,
      dynamicPath: trimmed,
      todayPreview: trimmed,
      tomorrowPreview: trimmed,
      isFile: /\.[a-zA-Z0-9]{2,5}$/.test(trimmed),
    };
  }

  // Tránh lặp kép thư mục gốc
  const doubleRoot = new RegExp(`^${STORAGE_MOUNT_CONFIG.rootFolderName}\\/${STORAGE_MOUNT_CONFIG.rootFolderName}\\/`, 'i');
  subPath = subPath.replace(doubleRoot, `${STORAGE_MOUNT_CONFIG.rootFolderName}/`);

  // Chuyển thành đường dẫn ổ Windows chuẩn theo cấu hình tập trung
  const windowsSubPath = subPath.replace(/\//g, '\\');
  const standardFixedPath = `${STORAGE_MOUNT_CONFIG.windowsSharePrefix}\\${windowsSubPath}`;

  // Tạo phiên bản đường dẫn động (${YYYY}, T${MM}.${YYYY}, ${DD}.${MM})
  let dynamicPath = standardFixedPath;
  dynamicPath = dynamicPath.replace(/T(0?[1-9]|1[0-2])\.(20\d{2})/g, 'T${MM}.${YYYY}');
  dynamicPath = dynamicPath.replace(/\b(202\d)\b/g, '${YYYY}');
  dynamicPath = dynamicPath.replace(/\b(0?[1-9]|[12]\d|3[01])\.(0?[1-9]|1[0-2])\b/g, '${DD}.${MM}');

  // Tính toán Live Preview (Hôm nay & Ngày mai theo múi giờ GMT+7)
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const todayYYYY = now.getUTCFullYear().toString();
  const todayMM = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const todayDD = now.getUTCDate().toString().padStart(2, '0');

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomYYYY = tomorrow.getUTCFullYear().toString();
  const tomMM = (tomorrow.getUTCMonth() + 1).toString().padStart(2, '0');
  const tomDD = tomorrow.getUTCDate().toString().padStart(2, '0');

  const evalPath = (p: string, y: string, m: string, d: string) =>
    p
      .replace(/\${YYYY}/g, y)
      .replace(/\${MM}/g, m)
      .replace(/\${DD}/g, d)
      .replace(/\${yyyy}/g, y)
      .replace(/\${mm}/g, m)
      .replace(/\${dd}/g, d);

  const todayPreview = evalPath(dynamicPath, todayYYYY, todayMM, todayDD);
  const tomorrowPreview = evalPath(dynamicPath, tomYYYY, tomMM, tomDD);

  const hasConversionDiff =
    standardFixedPath.toLowerCase() !== trimmed.toLowerCase() || dynamicPath !== trimmed;
  const hasDynamicVars = dynamicPath.includes('${');
  const isFile = /\.[a-zA-Z0-9]{2,5}$/.test(trimmed);

  return {
    hasConversionDiff,
    hasDynamicVars,
    suggestedPath: standardFixedPath,
    dynamicPath,
    todayPreview,
    tomorrowPreview,
    isFile,
  };
}
