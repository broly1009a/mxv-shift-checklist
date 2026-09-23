import * as fs from 'fs';
import * as path from 'path';
import { CcpLotStatisticsService } from '../modules/ccp-statistics/ccp-lot-statistics.service';

async function main() {
  const dataDir = path.join(__dirname, '../../test_data_2109');
  const dsgdCcp = fs.readFileSync(path.join(dataDir, 'DSGD.csv'));
  const ttm = fs.readFileSync(path.join(dataDir, 'TTM.csv'));
  const tttt = fs.readFileSync(path.join(dataDir, 'TTTT.csv'));
  const maHD = fs.existsSync(path.join(dataDir, 'HH.csv')) ? fs.readFileSync(path.join(dataDir, 'HH.csv')) : undefined;

  // Mock settingsService
  const mockSettingsService: any = {
    getSetting: async (key: string, defVal: string) => {
      if (key === 'usd_exchange_rate') return '25920';
      if (key === 'jpy_exchange_rate') return '170';
      if (key === 'myr_exchange_rate') return '6383';
      if (key === 'rmb_exchange_rate') return '3871';
      return defVal;
    },
    setSetting: async () => {},
  };

  const mockRunHistoryModel: any = {
    create: async () => {},
  };

  const service = new CcpLotStatisticsService(mockSettingsService, mockRunHistoryModel);

  console.log('Running processCcpLotStatistics on 21.09 data...');
  const result = await service.processCcpLotStatistics(
    { dsgdCcp, ttm, tttt, maHD },
    { ngayGD: '2026-09-21' }
  );

  const outPath = path.join(dataDir, 'ccp_output_2109.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`Saved output to ${outPath}`);
  console.log(`Total Lot: ${result.totalSoLot}, Total GTGD: ${result.totalGiaTri.toLocaleString('vi-VN')} VND`);
  console.log(`TVKD count: ${result.byTvkd.length}`);
}

main().catch(console.error);
