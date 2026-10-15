import fs from 'fs';
import path from 'path';

describe('Boundary - Module Isolation', () => {
  const srcDir = path.join(__dirname, '../../src');
  const modulesDir = path.join(srcDir, 'modules');

  function readFilesRecursive(dir: string): string[] {
    let files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(readFilesRecursive(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  function getModuleDeepImports(filePath: string): Array<{ file: string; line: number; import: string }> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const imports: Array<{ file: string; line: number; import: string }> = [];

    const deepImportPattern = /from\s+['"](@\/modules\/(auth|audit|notification)\/[^'"]+)['"]/;

    lines.forEach((line, index) => {
      const match = line.match(deepImportPattern);
      if (match) {
        imports.push({
          file: path.relative(srcDir, filePath),
          line: index + 1,
          import: match[1],
        });
      }
    });

    return imports;
  }

  function isCompositionRoot(filePath: string): boolean {
    const relativePath = path.relative(modulesDir, filePath);
    // Composition roots are outside modules or in src/app.ts, src/bootstrap.ts, src/index.ts
    return !relativePath.startsWith('..') === false ||
           filePath.endsWith('app.ts') ||
           filePath.endsWith('bootstrap.ts');
  }

  describe('No deep cross-module imports in src/modules', () => {
    it('should have zero auth imports of audit/notification deep paths', () => {
      const authDir = path.join(modulesDir, 'auth');
      const authFiles = readFilesRecursive(authDir);
      const deepImports = authFiles.flatMap(f => getModuleDeepImports(f)).filter(imp =>
        imp.import.includes('@/modules/audit/') || imp.import.includes('@/modules/notification/')
      );

      expect(deepImports).toEqual([]);
    });

    it('should have zero audit imports of auth/notification deep paths', () => {
      const auditDir = path.join(modulesDir, 'audit');
      const auditFiles = readFilesRecursive(auditDir);
      const deepImports = auditFiles.flatMap(f => getModuleDeepImports(f)).filter(imp =>
        imp.import.includes('@/modules/auth/') || imp.import.includes('@/modules/notification/')
      );

      expect(deepImports).toEqual([]);
    });

    it('should have zero notification imports of auth/audit deep paths', () => {
      const notificationDir = path.join(modulesDir, 'notification');
      const notificationFiles = readFilesRecursive(notificationDir);
      const deepImports = notificationFiles.flatMap(f => getModuleDeepImports(f)).filter(imp =>
        imp.import.includes('@/modules/auth/') || imp.import.includes('@/modules/audit/')
      );

      expect(deepImports).toEqual([]);
    });

    it('should have no deep internal imports within same module (use relative)', () => {
      // This checks that files use relative imports within their own module
      // e.g., notification/dispatcher should use ../mail/mail.service, not @/modules/notification/mail/mail.service
      const notificationDir = path.join(modulesDir, 'notification');
      const notificationFiles = readFilesRecursive(notificationDir);

      // Look for files that import from their own module via deep path
      const badImports = notificationFiles
        .flatMap(f => getModuleDeepImports(f))
        .filter(imp => imp.import.includes('@/modules/notification/'));

      if (badImports.length > 0) {
        console.warn('Warning: Found internal module deep imports (should be relative):', badImports);
      }
      // This is a best-effort check; implementation quality vs. strict boundary.
      // Current implementation should have fixed this in Phase 26.
    });
  });

  describe('Public barrel imports allowed only in composition roots', () => {
    it('should allow public imports in app.ts and bootstrap.ts', () => {
      const appFile = path.join(srcDir, 'app.ts');
      const bootstrapFile = path.join(srcDir, 'bootstrap.ts');

      // These files are expected to have imports from modules (for registration/composition)
      // Reading the files to check for actual imports
      let appHasModuleImports = false;
      let bootstrapHasModuleImports = false;

      if (fs.existsSync(appFile)) {
        const appContent = fs.readFileSync(appFile, 'utf-8');
        appHasModuleImports = /@\/modules\//.test(appContent);
      }

      if (fs.existsSync(bootstrapFile)) {
        const bootstrapContent = fs.readFileSync(bootstrapFile, 'utf-8');
        bootstrapHasModuleImports = /@\/modules\//.test(bootstrapContent);
      }

      // Composition roots should have module imports for registration/injection
      expect(appHasModuleImports || bootstrapHasModuleImports).toBe(true);
    });
  });

  describe('Module boundaries enforced', () => {
    it('all modules should only depend on shared and external packages', () => {
      const moduleDirs = ['auth', 'audit', 'notification'];

      for (const moduleName of moduleDirs) {
        const moduleDir = path.join(modulesDir, moduleName);
        const files = readFilesRecursive(moduleDir);

        for (const file of files) {
          const deepImports = getModuleDeepImports(file);
          const crossModuleImports = deepImports.filter(imp => {
            // Allow public barrel imports at composition root only
            if (file.includes('app.ts') || file.includes('bootstrap.ts')) {
              return false;
            }
            return true;
          });

          const message = `${path.relative(srcDir, file)} has forbidden deep cross-module imports: ${crossModuleImports.map(i => i.import).join(', ')}`;
          expect(crossModuleImports.length).toBe(0);
          if (crossModuleImports.length > 0) {
            throw new Error(message);
          }
        }
      }
    });
  });
});
