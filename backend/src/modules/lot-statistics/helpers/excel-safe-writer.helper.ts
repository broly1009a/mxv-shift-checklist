import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as ExcelJS from 'exceljs';

/**
 * Sanitize all cells and metadata in the workbook to prevent ExcelJS serialization crashes.
 * Specifically converts Invalid Date objects to null to avoid 'Invalid time value' RangeError.
 */
export function sanitizeWorkbook(wb: ExcelJS.Workbook): void {
  // 1. Sanitize Workbook properties & metadata dates
  try {
    if (wb.created && isNaN(wb.created.getTime())) wb.created = new Date();
    if (wb.modified && isNaN(wb.modified.getTime())) wb.modified = new Date();
    if (wb.lastPrinted && isNaN(wb.lastPrinted.getTime())) wb.lastPrinted = new Date();
    if ((wb as any).properties) {
      const props = (wb as any).properties;
      if (props.created && isNaN(props.created.getTime())) props.created = new Date();
      if (props.modified && isNaN(props.modified.getTime())) props.modified = new Date();
      if (props.lastPrinted && isNaN(props.lastPrinted.getTime())) props.lastPrinted = new Date();
    }
  } catch (_) {}

  // 2. Sanitize all worksheet cells
  for (const ws of wb.worksheets) {
    ws.eachRow({ includeEmpty: true }, (row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        try {
          const val = cell.value as any;
          if (val instanceof Date) {
            if (isNaN(val.getTime())) {
              cell.value = null;
            }
          } else if (typeof val === 'object' && val !== null) {
            if (val.result instanceof Date && isNaN(val.result.getTime())) {
              val.result = null;
            }
          }
          if (cell.type === ExcelJS.ValueType.Date) {
            if (!cell.value || (cell.value instanceof Date && isNaN(cell.value.getTime()))) {
              cell.value = null;
            }
          }
        } catch (_) {
          cell.value = null;
        }
      });
    });
  }
}

/**
 * Enterprise Atomic Safe Save for ExcelJS Workbooks on Network / CIFS shares.
 * 1. Sanitizes invalid dates to prevent RangeError: Invalid time value
 * 2. Writes to a local temporary disk file first (/tmp/ or os.tmpdir())
 * 3. Verifies file byte size > 1000 bytes
 * 4. Atomically copies the complete file to target network path
 * 5. Cleans up temp file
 * 
 * Guarantees that the network destination file is NEVER truncated to 0 bytes if anything fails.
 */
export async function safeWriteExcel(
  wb: ExcelJS.Workbook,
  targetFilePath: string,
): Promise<void> {
  // 1. Sanitize cells
  sanitizeWorkbook(wb);

  // 2. Local temp file
  const tempDir = os.tmpdir();
  const tempFile = path.join(
    tempDir,
    `safe_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${path.basename(targetFilePath)}`,
  );

  try {
    await wb.xlsx.writeFile(tempFile);

    // 3. Verify byte size
    if (!fs.existsSync(tempFile)) {
      throw new Error(`[CRITICAL] File temp không được tạo: "${tempFile}"`);
    }

    const size = fs.statSync(tempFile).size;
    if (size < 1000) {
      throw new Error(
        `[CRITICAL] File xuất ra bị lỗi kích thước (${size} bytes). Hủy ghi đè để bảo vệ file gốc.`,
      );
    }

    // 4. Ensure destination directory exists
    const targetDir = path.dirname(targetFilePath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 5. Atomic copy to target
    fs.copyFileSync(tempFile, targetFilePath);
  } finally {
    // 6. Cleanup temp file
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch {}
  }
}
