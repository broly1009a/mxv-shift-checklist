import { MsExcelParser, MsTradeRecord } from './ms-excel.parser';

export class StraitsCsvParser {
  /**
   * Parse Straits CSV file (Straits.csv / Straits_DDMMYYYY.csv)
   */
  public static parseStraitsCsv(buffer: Buffer): MsTradeRecord[] {
    const text = buffer.toString('utf-8');
    const lines = text.split(/\r?\n/);
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const buyColIndex = headers.indexOf('buy');
    const sellColIndex = headers.indexOf('sell');
    const priceColIndex = headers.indexOf('price');
    const executionTimeColIndex = headers.indexOf('execution date-time');
    const brokerTradeIdColIndex = headers.indexOf('broker trade id');
    const subAccColIndex = headers.indexOf('sub-a/c');
    const productCodeColIndex = headers.indexOf('product code');

    if (buyColIndex === -1 || sellColIndex === -1) {
      throw new Error(
        "Không tìm thấy cột 'Buy' hoặc 'Sell' trong file CSV Straits",
      );
    }

    const result: MsTradeRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',');

      const buyVal =
        buyColIndex !== -1 && buyColIndex < values.length
          ? parseFloat(values[buyColIndex].replace(/"/g, '').trim()) || 0
          : 0;
      const sellVal =
        sellColIndex !== -1 && sellColIndex < values.length
          ? parseFloat(values[sellColIndex].replace(/"/g, '').trim()) || 0
          : 0;
      const volume = buyVal + sellVal;
      if (volume === 0) continue;

      const maLenh =
        brokerTradeIdColIndex !== -1 &&
        brokerTradeIdColIndex < values.length
          ? values[brokerTradeIdColIndex].replace(/"/g, '').trim()
          : 'STRAITS';
      const maTKGD =
        subAccColIndex !== -1 && subAccColIndex < values.length
          ? MsExcelParser.getNormalizedAccount(
              values[subAccColIndex].replace(/"/g, '').trim(),
            )
          : 'Straits';
      const maHD =
        productCodeColIndex !== -1 && productCodeColIndex < values.length
          ? values[productCodeColIndex].replace(/"/g, '').trim()
          : 'Straits';
      const giaKhop =
        priceColIndex !== -1 && priceColIndex < values.length
          ? parseFloat(values[priceColIndex].replace(/"/g, '').trim()) || 0
          : 0;
      const ngayGio =
        executionTimeColIndex !== -1 &&
        executionTimeColIndex < values.length
          ? values[executionTimeColIndex].replace(/"/g, '').trim()
          : '';
      const maGD = maLenh;

      result.push({
        maLenh,
        maTKGD,
        maHD,
        klGiaoDich: volume,
        giaKhop,
        ngayGio,
        maGD,
        combinedKey: `${maTKGD}${maGD}${volume}`,
      });
    }
    return result;
  }
}
