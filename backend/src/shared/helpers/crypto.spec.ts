import * as nodeCrypto from 'crypto';
import { encrypt, decrypt, hasConfiguredEncryptionKey } from './crypto';

describe('Crypto Helper (Unit Tests & Multi-Tier Decryption Gate)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('TC-CRYPTO-01: Mã hóa và giải mã thành công chuỗi văn bản thông thường', () => {
    const raw = 'SecurePassword@2026!';
    const cipher = encrypt(raw);
    expect(cipher).toContain(':');
    const plain = decrypt(cipher);
    expect(plain).toBe(raw);
  });

  it('TC-CRYPTO-02: Hoạt động chuẩn xác khi cấu hình biến môi trường ENCRYPTION_KEY tùy biến', () => {
    process.env.ENCRYPTION_KEY = 'my_super_secret_enterprise_vault_key_2026';
    expect(hasConfiguredEncryptionKey()).toBe(true);

    const secretData = JSON.stringify({ username: 'ops_bot', secret: 'TopSecret123' });
    const encrypted = encrypt(secretData);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(secretData);
    expect(JSON.parse(decrypted)).toEqual({ username: 'ops_bot', secret: 'TopSecret123' });
  });

  it('TC-CRYPTO-03: Tương thích ngược: Giải mã thành công dữ liệu cũ được mã hóa bằng "mxv_secret_salt_fixed"', () => {
    // Tạo ciphertext giả lập chuẩn bot_credentials cũ
    const fixedKey = nodeCrypto.createHash('sha256').update('mxv_secret_salt_fixed').digest();
    const iv = nodeCrypto.randomBytes(16);
    const cipher = nodeCrypto.createCipheriv('aes-256-cbc', fixedKey, iv);
    const legacyPlain = 'LegacyCredentialsOldFormat_CQG_Password';
    let encrypted = cipher.update(legacyPlain, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const legacyCiphertext = iv.toString('hex') + ':' + encrypted.toString('hex');

    // Chạy hàm decrypt() với key môi trường khác để kiểm chứng tầng 2 giải mã thành công
    process.env.ENCRYPTION_KEY = 'completely_different_new_env_key';
    const result = decrypt(legacyCiphertext);
    expect(result).toBe(legacyPlain);
  });

  it('TC-CRYPTO-04: Tương thích ngược: Giải mã thành công dữ liệu được mã hóa bằng LEGACY_DEFAULT_KEY', () => {
    const legacyKey = nodeCrypto.createHash('sha256').update('mxv_default_secret_key_32_chars_long!').digest();
    const iv = nodeCrypto.randomBytes(16);
    const cipher = nodeCrypto.createCipheriv('aes-256-cbc', legacyKey, iv);
    const legacyPlain = 'DefaultKeyEncryptedData';
    let encrypted = cipher.update(legacyPlain, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const legacyCiphertext = iv.toString('hex') + ':' + encrypted.toString('hex');

    process.env.ENCRYPTION_KEY = 'different_key_for_testing';
    const result = decrypt(legacyCiphertext);
    expect(result).toBe(legacyPlain);
  });

  it('TC-CRYPTO-05: Trả về chuỗi rỗng khi text rỗng, passthrough khi là JSON thuần, và ném lỗi khi dữ liệu hỏng', () => {
    expect(encrypt('')).toBe('');
    expect(decrypt('')).toBe('');

    // JSON thuần không mã hóa (passthrough)
    const rawJson = '{"url":"https://coreccp.vnclear.vn"}';
    expect(decrypt(rawJson)).toBe(rawJson);

    // Ciphertext bị can thiệp / hỏng
    const invalidCipher = '1234567890abcdef1234567890abcdef:deadbeef1234';
    expect(() => decrypt(invalidCipher)).toThrow('Không thể giải mã dữ liệu');
  });

  it('TC-CRYPTO-06: hasConfiguredEncryptionKey phản ánh chính xác trạng thái biến môi trường', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(hasConfiguredEncryptionKey()).toBe(false);

    process.env.ENCRYPTION_KEY = '   ';
    expect(hasConfiguredEncryptionKey()).toBe(false);

    process.env.ENCRYPTION_KEY = 'valid_key_present';
    expect(hasConfiguredEncryptionKey()).toBe(true);
  });
});

