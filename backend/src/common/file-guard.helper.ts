import * as path from 'path';

/**
 * Ensures that target files can only be written to allowed output root paths.
 * Prevents accidental write operations into source backup/production directories.
 */
export function assertSafeWritePath(filePath: string, allowedOutputRoot: string): void {
  if (!allowedOutputRoot || allowedOutputRoot.trim() === '') {
    // If no allowed output root configured, skip check (or log warning)
    return;
  }

  const resolvedTarget = path.resolve(filePath);
  const resolvedAllowed = path.resolve(allowedOutputRoot);

  if (!resolvedTarget.startsWith(resolvedAllowed)) {
    throw new Error(
      `[SECURITY GUARD] Từ chối ghi file ra ngoài thư mục output cho phép!\n` +
      `  - Thư mục được phép: "${resolvedAllowed}"\n` +
      `  - Thư mục định ghi: "${resolvedTarget}"`
    );
  }
}
