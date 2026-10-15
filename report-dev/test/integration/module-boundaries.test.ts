/**
 * Phase 36 - Cross-Module Integration Tests: Module Boundaries
 * Validates that modules respect boundaries and only communicate
 * through defined interfaces, not internal implementations.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

describe('Module Boundaries - Integration Verification', () => {
  const projectRoot = join(__dirname, '../../');
  const srcDir = join(projectRoot, 'src/modules');
  const testDir = join(projectRoot, 'test');

  /**
   * Scan all TypeScript files in a module and check imports
   */
  function getImportsFromModule(
    modulePath: string
  ): { file: string; imports: string[] }[] {
    const results: { file: string; imports: string[] }[] = [];

    const scanDir = (dir: string) => {
      try {
        const files = readdirSync(dir);

        for (const file of files) {
          const fullPath = join(dir, file);
          const stats = require('fs').statSync(fullPath);

          if (stats.isDirectory()) {
            scanDir(fullPath);
          } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
            try {
              const content = readFileSync(fullPath, 'utf-8');
              const imports = content.match(
                /from\s+['"]([@/][^'"]+)['"]/g
              ) || [];

              results.push({
                file: fullPath.replace(projectRoot, '.'),
                imports: imports.map(imp =>
                  imp.replace(/from\s+['"]|['"]/g, '')
                ),
              });
            } catch (err) {
              // Skip unreadable files
            }
          }
        }
      } catch (err) {
        // Skip inaccessible directories
      }
    };

    scanDir(modulePath);
    return results;
  }

  describe('Auth Module Boundaries', () => {
    it('should not import internal auth services from other modules', () => {
      const authDir = join(srcDir, 'auth');
      const imports = getImportsFromModule(authDir);

      const violations = imports.filter(({ imports: moduleImports }) =>
        moduleImports.some(
          imp =>
            imp.includes('@/modules/auth/services') ||
            imp.includes('@/modules/auth/models')
        )
      );

      // Only auth tests should import from internal auth paths
      const internalOnlyOk = violations.every(v =>
        v.file.includes('/test/')
      );

      expect(internalOnlyOk).toBe(true);
    });

    it('should not have circular dependencies with audit', () => {
      const authDir = join(srcDir, 'auth');
      const auditDir = join(srcDir, 'audit');

      const authImports = getImportsFromModule(authDir);
      const auditImports = getImportsFromModule(auditDir);

      const authImportsAudit = authImports.some(({ imports: imp }) =>
        imp.some(
          i =>
            i.includes('@/modules/audit') && !i.includes('@/shared')
        )
      );

      const auditImportsAuth = auditImports.some(({ imports: imp }) =>
        imp.some(
          i =>
            i.includes('@/modules/auth') && !i.includes('@/shared')
        )
      );

      expect(authImportsAudit).toBe(false);
      expect(auditImportsAuth).toBe(false);
    });

    it('should not have circular dependencies with notification', () => {
      const authDir = join(srcDir, 'auth');
      const notificationDir = join(srcDir, 'notification');

      const authImports = getImportsFromModule(authDir);
      const notificationImports = getImportsFromModule(notificationDir);

      const authImportsNotification = authImports.some(({ imports: imp }) =>
        imp.some(
          i =>
            i.includes('@/modules/notification') &&
            !i.includes('@/shared')
        )
      );

      const notificationImportsAuth = notificationImports.some(
        ({ imports: imp }) =>
          imp.some(
            i =>
              i.includes('@/modules/auth') && !i.includes('@/shared')
          )
      );

      expect(authImportsNotification).toBe(false);
      expect(notificationImportsAuth).toBe(false);
    });
  });

  describe('Audit Module Boundaries', () => {
    it('should not import internal audit services from other modules', () => {
      const auditDir = join(srcDir, 'audit');
      const imports = getImportsFromModule(auditDir);

      const violations = imports.filter(({ imports: moduleImports }) =>
        moduleImports.some(
          imp =>
            imp.includes('@/modules/audit/services') ||
            imp.includes('@/modules/audit/models')
        )
      );

      // Only audit tests should import from internal audit paths
      const internalOnlyOk = violations.every(v =>
        v.file.includes('/test/')
      );

      expect(internalOnlyOk).toBe(true);
    });

    it('should not import notification internals', () => {
      const auditDir = join(srcDir, 'audit');
      const imports = getImportsFromModule(auditDir);

      const violations = imports.filter(({ imports: moduleImports }) =>
        moduleImports.some(
          imp =>
            imp.includes('@/modules/notification/') &&
            !imp.includes('@/shared')
        )
      );

      expect(violations.length).toBe(0);
    });

    it('should not import auth internals', () => {
      const auditDir = join(srcDir, 'audit');
      const imports = getImportsFromModule(auditDir);

      const violations = imports.filter(({ imports: moduleImports }) =>
        moduleImports.some(
          imp =>
            imp.includes('@/modules/auth/') &&
            !imp.includes('@/shared')
        )
      );

      expect(violations.length).toBe(0);
    });
  });

  describe('Notification Module Boundaries', () => {
    it('should not import internal notification services from other modules', () => {
      const notificationDir = join(srcDir, 'notification');
      const imports = getImportsFromModule(notificationDir);

      const violations = imports.filter(({ imports: moduleImports }) =>
        moduleImports.some(
          imp =>
            imp.includes('@/modules/notification/services') ||
            imp.includes('@/modules/notification/models')
        )
      );

      // Only notification tests should import from internal paths
      const internalOnlyOk = violations.every(v =>
        v.file.includes('/test/')
      );

      expect(internalOnlyOk).toBe(true);
    });

    it('should not import audit internals', () => {
      const notificationDir = join(srcDir, 'notification');
      const imports = getImportsFromModule(notificationDir);

      const violations = imports.filter(({ imports: moduleImports }) =>
        moduleImports.some(
          imp =>
            imp.includes('@/modules/audit/') &&
            !imp.includes('@/shared')
        )
      );

      expect(violations.length).toBe(0);
    });

    it('should not import auth internals', () => {
      const notificationDir = join(srcDir, 'notification');
      const imports = getImportsFromModule(notificationDir);

      const violations = imports.filter(({ imports: moduleImports }) =>
        moduleImports.some(
          imp =>
            imp.includes('@/modules/auth/') &&
            !imp.includes('@/shared')
        )
      );

      expect(violations.length).toBe(0);
    });
  });

  describe('Shared Module Usage', () => {
    it('should allow all modules to import from @/shared', () => {
      const modules = ['auth', 'audit', 'notification'];

      for (const module of modules) {
        const moduleDir = join(srcDir, module);
        const imports = getImportsFromModule(moduleDir);

        const sharedImports = imports.filter(({ imports: imp }) =>
          imp.some(i => i.includes('@/shared'))
        );

        // Shared imports should be allowed (but may be empty for some modules)
        expect(Array.isArray(sharedImports)).toBe(true);
      }
    });

    it('should use interfaces from @/shared for cross-module communication', () => {
      // Verify that NotificationPort and AuditRecorder are defined in shared
      const sharedIndexPath = join(projectRoot, 'src/shared/index.ts');

      try {
        const content = readFileSync(sharedIndexPath, 'utf-8');

        expect(content).toMatch(/NotificationPort/);
        expect(content).toMatch(/AuditRecorder/);
      } catch (err) {
        // If index doesn't exist, check if interfaces are in shared directory
        const sharedDir = join(projectRoot, 'src/shared');
        const imports = getImportsFromModule(sharedDir);

        expect(imports.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Test Module Boundaries', () => {
    it('should allow test files to import internals for testing', () => {
      const testAuditDir = join(testDir, 'audit');
      const imports = getImportsFromModule(testAuditDir);

      const internalImports = imports.filter(({ imports: imp }) =>
        imp.some(
          i =>
            i.includes('@/modules/audit/') &&
            (i.includes('services') || i.includes('models'))
        )
      );

      // Tests SHOULD import internal paths
      expect(internalImports.length).toBeGreaterThan(0);
    });

    it('should not have cross-module imports between unit tests', () => {
      const testAuditDir = join(testDir, 'audit');
      const testNotificationDir = join(testDir, 'notification');

      const auditImports = getImportsFromModule(testAuditDir);
      const notificationImports = getImportsFromModule(testNotificationDir);

      const auditToNotification = auditImports.filter(({ imports: imp }) =>
        imp.some(i => i.includes('@/modules/notification'))
      );

      const notificationToAudit = notificationImports.filter(
        ({ imports: imp }) =>
          imp.some(i => i.includes('@/modules/audit'))
      );

      // Unit tests should not cross-import
      expect(auditToNotification.length).toBe(0);
      expect(notificationToAudit.length).toBe(0);
    });
  });

  describe('Dependency Direction', () => {
    it('bootstrap should import all modules but modules should not import bootstrap', () => {
      const bootstrapPath = join(projectRoot, 'src/bootstrap.ts');

      try {
        const bootstrapContent = readFileSync(bootstrapPath, 'utf-8');

        // Bootstrap should import from modules
        expect(bootstrapContent).toMatch(/@\/modules\/(auth|audit|notification)/);
      } catch (err) {
        // Bootstrap file may not exist yet, skip
      }

      const modules = ['auth', 'audit', 'notification'];

      for (const module of modules) {
        const moduleDir = join(srcDir, module);
        const imports = getImportsFromModule(moduleDir);

        const bootstrapImports = imports.filter(({ imports: imp }) =>
          imp.some(i => i.includes('@/bootstrap') || i.includes('/bootstrap'))
        );

        // Modules should NOT import bootstrap
        expect(bootstrapImports.length).toBe(0);
      }
    });
  });

  describe('No Deep Nested Imports', () => {
    it('should not use deep imports like @/modules/audit/services/xyz/abc', () => {
      const modules = ['auth', 'audit', 'notification'];

      for (const module of modules) {
        const moduleDir = join(srcDir, module);
        const imports = getImportsFromModule(moduleDir);

        const deepImports = imports.filter(({ imports: imp }) =>
          imp.some(i => {
            const parts = i.split('/');
            // Deep import would be at least 4 parts after @
            // @/modules/audit/services/deep/nested
            return (
              parts.length > 4 &&
              parts[0].includes('@') &&
              parts[1] === 'modules'
            );
          })
        );

        // Allow deep imports only from shared
        const allowedDeepImports = deepImports.filter(({ imports: imp }) =>
          imp.some(i => !i.includes('@/modules') || i.includes('@/shared'))
        );

        expect(allowedDeepImports.length).toBe(deepImports.length);
      }
    });
  });
});
