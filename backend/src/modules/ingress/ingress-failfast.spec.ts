import { IngressService } from './ingress.service';
import { CcpScraperService } from './scrapers/ccp-scraper.service';
import { AcmScraperService } from './scrapers/acm-scraper.service';

describe('Ingress Service & Scrapers (Fail-Fast & Zero-Hardcode Gates)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('IngressService Download Gates', () => {
    it('TC-INGRESS-01: Ném ngoại lệ [PARTNER_SERVICE_UNAVAILABLE] khi tải ACM mà thiếu thông số SFTP host/username', async () => {
      delete process.env.ACM_SFTP_HOST;
      delete process.env.ACM_SFTP_USER;

      const mockSettings: any = {
        getSetting: jest.fn().mockImplementation((key: string, defVal: any) => {
          if (key === 'bot_credentials_acm') return '';
          return defVal;
        }),
      };

      const ingressService = new IngressService(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        mockSettings,
      );

      await expect(
        ingressService.download('ACM', {
          targetDirectory: './temp_test_acm',
          mode: 'PLAYWRIGHT',
        } as any),
      ).rejects.toThrow(/\[PARTNER_SERVICE_UNAVAILABLE\].*SFTP ACM/);
    });

    it('TC-INGRESS-02: Ném ngoại lệ [PARTNER_SERVICE_UNAVAILABLE] khi tải CCP mà thiếu bot_credentials_ccp.url', async () => {
      delete process.env.CCP_URL;

      const mockSettings: any = {
        getSetting: jest.fn().mockImplementation((key: string, defVal: any) => {
          if (key === 'bot_credentials_ccp') {
            return JSON.stringify({ username: 'test', password: 'pwd', url: '' });
          }
          return defVal;
        }),
      };

      const ingressService = new IngressService(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        mockSettings,
      );

      await expect(
        ingressService.download('CCP', {
          targetDirectory: './temp_test_ccp',
          mode: 'PLAYWRIGHT',
        } as any),
      ).rejects.toThrow(/\[PARTNER_SERVICE_UNAVAILABLE\].*URL CoreCCP/);
    });
  });

  describe('CcpScraperService Gates', () => {
    it('TC-INGRESS-03: CcpScraperService.login ném [PARTNER_SERVICE_UNAVAILABLE] khi URL bị rỗng', async () => {
      const ccpScraper = new CcpScraperService();
      await expect(
        ccpScraper.login({ username: 'bot', password: 'pwd', url: '' }),
      ).rejects.toThrow(/\[PARTNER_SERVICE_UNAVAILABLE\].*URL đăng nhập CoreCCP/);
    });
  });

  describe('AcmScraperService Gates', () => {
    it('TC-INGRESS-04: AcmScraperService.downloadStraitsViaSftp ném [PARTNER_SERVICE_UNAVAILABLE] khi host/username rỗng', async () => {
      const acmScraper = new AcmScraperService();
      await expect(
        acmScraper.downloadStraitsViaSftp({
          host: '',
          username: '',
          localDir: './temp_test_acm_local',
        }),
      ).rejects.toThrow(/\[PARTNER_SERVICE_UNAVAILABLE\].*kết nối SFTP ACM/);
    });
  });
});
