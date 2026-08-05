import * as path from 'path';
import * as fs from 'fs';

/**
 * Ensures that target files can only be written to allowed output root paths.
 * Prevents accidental write operations into source backup/production directories.
 */
export function assertSafeWritePath(
  filePath: string,
  allowedOutputRoot: string,
): void {
  if (!allowedOutputRoot || allowedOutputRoot.trim() === '') {
    // If no allowed output root configured, skip check (or log warning)
    return;
  }

  const resolvedTarget = path.resolve(filePath);
  const resolvedAllowed = path.resolve(allowedOutputRoot);

  if (!resolvedTarget.toLowerCase().startsWith(resolvedAllowed.toLowerCase())) {
    throw new Error(
      `[SECURITY GUARD] Từ chối ghi file ra ngoài thư mục output cho phép!\n` +
        `  - Thư mục được phép: "${resolvedAllowed}"\n` +
        `  - Thư mục định ghi: "${resolvedTarget}"`,
    );
  }
}

/**
 * Checks if a required file exists in target path.
 * If missing in output targetRoot, automatically attempts to copy it over from DATA_ROOT source directory.
 */
export function ensureBaseFileExists(filePath: string): boolean {
  if (fs.existsSync(filePath)) {
    return true;
  }

  const dataRoot = process.env.DATA_ROOT;
  const targetRoot = process.env.BOT_LOT_MACRO_TARGET_ROOT;

  if (dataRoot && targetRoot) {
    const resolvedTarget = path.resolve(filePath);
    const resolvedAllowedRoot = path.resolve(targetRoot);

    if (resolvedTarget.startsWith(resolvedAllowedRoot)) {
      // Find UAT/Production root by going up 2 levels from allowed root (which ends with <Dept>/<Subfolder>)
      const uatRoot = path.dirname(path.dirname(resolvedAllowedRoot));
      const relativePath = path.relative(uatRoot, resolvedTarget);
      const sourceCandidate = path.join(dataRoot, relativePath);

      if (fs.existsSync(sourceCandidate)) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.copyFileSync(sourceCandidate, filePath);
        console.log(
          `[AUTO-SYNC] Đã tự động kéo file thiếu từ DATA_ROOT sang UAT Output:\n  Nguồn: "${sourceCandidate}"\n  Đích: "${filePath}"`,
        );
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks if a required directory exists in target path.
 * If missing in output targetRoot, automatically attempts to copy the folder files from DATA_ROOT source directory.
 */
export function ensureBaseDirectoryExists(dirPath: string): boolean {
  if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
    return true;
  }

  const dataRoot = process.env.DATA_ROOT;
  const targetRoot = process.env.BOT_LOT_MACRO_TARGET_ROOT;

  if (dataRoot && targetRoot) {
    const resolvedTarget = path.resolve(dirPath);
    const resolvedAllowedRoot = path.resolve(targetRoot);

    if (resolvedTarget.startsWith(resolvedAllowedRoot)) {
      // Find UAT/Production root by going up 2 levels from allowed root (which ends with <Dept>/<Subfolder>)
      const uatRoot = path.dirname(path.dirname(resolvedAllowedRoot));
      const relativePath = path.relative(uatRoot, resolvedTarget);
      const sourceCandidate = path.join(dataRoot, relativePath);

      if (
        fs.existsSync(sourceCandidate) &&
        fs.statSync(sourceCandidate).isDirectory()
      ) {
        fs.mkdirSync(dirPath, { recursive: true });
        const files = fs.readdirSync(sourceCandidate);
        for (const file of files) {
          const srcFile = path.join(sourceCandidate, file);
          const destFile = path.join(dirPath, file);
          if (fs.statSync(srcFile).isFile()) {
            fs.copyFileSync(srcFile, destFile);
          }
        }
        console.log(
          `[AUTO-SYNC] Đã tự động kéo thư mục thiếu từ DATA_ROOT sang UAT Output:\n  Nguồn: "${sourceCandidate}"\n  Đích: "${dirPath}"`,
        );
        return true;
      }
    }
  }

  return false;
}
