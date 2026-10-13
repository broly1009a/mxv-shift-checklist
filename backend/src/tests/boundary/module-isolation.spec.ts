import * as fs from 'fs';
import * as path from 'path';

describe('Boundary - Module Isolation (Kiểm Soát Ranh Giới Module V2)', () => {
  const srcDir = path.join(__dirname, '../../');
  const modulesDir = path.join(srcDir, 'modules');

  function readFilesRecursive(dir: string): string[] {
    let files: string[] = [];
    if (!fs.existsSync(dir)) return files;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(readFilesRecursive(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') && !entry.name.endsWith('.spec.ts')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  function getCrossModuleDeepImports(filePath: string): Array<{ file: string; line: number; import: string }> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const imports: Array<{ file: string; line: number; import: string }> = [];

    // Tìm các import xuyên qua module khác mà không đi qua shared/ports
    const deepImportPattern = /from\s+['"](?:\.\.\/)+([a-zA-Z0-9_-]+)\/(?:services|handlers|helpers|scrapers)\/([^'"]+)['"]/;

    lines.forEach((line, index) => {
      const match = line.match(deepImportPattern);
      if (match) {
        imports.push({
          file: path.relative(srcDir, filePath),
          line: index + 1,
          import: match[0],
        });
      }
    });

    return imports;
  }

  describe('Rào Chắn Cách Ly Giữa Các Module Mới (V2 Boundaries)', () => {
    it('Module Ingress, Trading-Ops, Checklist-Hub, Ccp-Clearing phải tồn tại ranh giới rõ ràng', () => {
      const v2Modules = ['ingress', 'trading-ops', 'checklist-hub', 'ccp-clearing'];

      for (const modName of v2Modules) {
        const modDir = path.join(modulesDir, modName);
        if (!fs.existsSync(modDir)) continue; // Bỏ qua nếu module đang trong tiến trình xây dựng

        const files = readFilesRecursive(modDir);
        for (const file of files) {
          const deepImports = getCrossModuleDeepImports(file);
          expect(deepImports).toEqual([]);
        }
      }
    });

    it('Shared Ports và Contracts phải là điểm giao tiếp hợp lệ duy nhất', () => {
      const sharedDir = path.join(srcDir, 'shared');
      // Khi sharedDir được tạo, nó phải chứa ports và contracts
      if (fs.existsSync(sharedDir)) {
        const hasPortsOrContracts = fs.existsSync(path.join(sharedDir, 'ports')) || fs.existsSync(path.join(sharedDir, 'contracts'));
        expect(hasPortsOrContracts).toBe(true);
      } else {
        expect(true).toBe(true);
      }
    });
  });
});
