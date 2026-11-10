import * as crypto from 'crypto';

const LEGACY_DEFAULT_KEY = 'mxv_default_secret_key_32_chars_long!';
const LEGACY_SALT_FIXED = 'mxv_secret_salt_fixed';
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Kiểm tra xem biến môi trường ENCRYPTION_KEY đã được thiết lập đúng chuẩn hay chưa
 */
export function hasConfiguredEncryptionKey(): boolean {
  return Boolean(process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.trim().length > 0);
}

// Stretch any environment key to exactly 32 bytes (256 bits) for AES-256
const getSecretKey = (): Buffer => {
  const rawKey = process.env.ENCRYPTION_KEY;
  if (!rawKey) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '⚠️ [SECURITY WARNING] Biến môi trường ENCRYPTION_KEY chưa được cấu hình trên Production! Đang dùng key dự phòng.',
      );
    }
    return crypto.createHash('sha256').update(LEGACY_DEFAULT_KEY).digest();
  }
  return crypto.createHash('sha256').update(rawKey).digest();
};

/**
 * Encrypts a plain text string using AES-256-CBC.
 * Returns the format: iv_hex:encrypted_hex
 */
export function encrypt(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getSecretKey(), iv);
  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function tryDecryptWithKey(encrypted: Buffer, iv: Buffer, key: Buffer): string | null {
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    const str = decrypted.toString('utf8');
    // Kiểm tra xem chuỗi giải mã có chứa ký tự không in được bất thường (dấu hiệu sai key dù padding trùng)
    // Cho phép các ký tự in được thông thường, newline, tab, và ký tự tiếng Việt
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x08\x0E-\x1F]/.test(str)) {
      return null;
    }
    return str;
  } catch {
    return null;
  }
}

/**
 * Decrypts an encrypted hex string (format: iv_hex:encrypted_hex).
 * Tự động hỗ trợ Fallback giải mã an toàn 3 tầng (Current Key -> Fixed Salt -> Legacy Default Key)
 * để đảm bảo tuyệt đối không làm gãy dữ liệu tài khoản bot_credentials đã lưu trước đây trong CSDL.
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    try {
      JSON.parse(encryptedText);
      return encryptedText;
    } catch {
      throw new Error('Format mã hóa không hợp lệ (thiếu IV)');
    }
  }
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');

  // Thử 1: Giải mã bằng getSecretKey() (ENCRYPTION_KEY từ biến môi trường)
  const res1 = tryDecryptWithKey(encrypted, iv, getSecretKey());
  if (res1 !== null) return res1;

  // Thử 2: Giải mã bằng mxv_secret_salt_fixed (chuẩn bot_credentials cũ)
  const fixedKey = crypto.createHash('sha256').update(LEGACY_SALT_FIXED).digest();
  const res2 = tryDecryptWithKey(encrypted, iv, fixedKey);
  if (res2 !== null) return res2;

  // Thử 3: Giải mã bằng LEGACY_DEFAULT_KEY (nếu ENCRYPTION_KEY khác key mặc định cũ)
  const legacyKey = crypto.createHash('sha256').update(LEGACY_DEFAULT_KEY).digest();
  const res3 = tryDecryptWithKey(encrypted, iv, legacyKey);
  if (res3 !== null) return res3;

  throw new Error('Không thể giải mã dữ liệu: Sai khóa mã hóa hoặc dữ liệu đã bị hỏng!');
}
