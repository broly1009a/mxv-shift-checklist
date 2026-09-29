import { TkgdQueryAnalyticsService } from './tkgd-query-analytics.service';

describe('TkgdQueryAnalyticsService.getRecords', () => {
  const createService = (records: any[]) => {
    const cleanRecordModel = {
      find: jest.fn(() => ({
        sort: jest.fn(() => ({
          lean: jest.fn().mockResolvedValue(records),
        })),
      })),
      updateMany: jest.fn(() => ({ exec: jest.fn().mockResolvedValue({}) })),
    };

    return new TkgdQueryAnalyticsService(
      cleanRecordModel as any,
      {} as any,
      {} as any,
    );
  };

  it('groups base and sub-account records and preserves the worst status', async () => {
    const records = [
      {
        _id: 'futures-id',
        maTKGD: '003C1234567',
        maTKGDBase: '003C1234567',
        accountType: 'FUTURES',
        noiDungMail: { maTKGD_Futures: '003C1234567', tenTaiKhoan: 'Nguyen Van A' },
        ketLuan: { trangThai: 'KHOP', danhSachLoi: [] },
      },
      {
        _id: 'acm-id',
        maTKGD: '003C1234567-A',
        maTKGDBase: '003C1234567',
        accountType: 'ACM',
        noiDungMail: { maTKGD_ACM: '003C1234567-A', hasACMRequest: true },
        ketLuan: { trangThai: 'LECH', danhSachLoi: ['name mismatch'] },
      },
    ];

    const service = createService(records);

    const result = await service.getRecords({ limit: 20, page: 1 });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].maTKGDBase).toBe('003C1234567');
    expect(result.items[0].accountTypes).toEqual(expect.arrayContaining(['FUTURES', 'ACM']));
    expect(result.items[0].subAccounts).toEqual([
      expect.objectContaining({ code: '003C1234567-A', type: 'ACM', status: 'LECH' }),
    ]);
    expect(result.items[0].ketLuan.trangThai).toBe('LECH');
    expect(result.stats.mismatchedCount).toBe(1);
  });

  it('filters grouped records by status without changing global stats', async () => {
    const records = [
      {
        _id: 'matched-id',
        maTKGD: '003C1111111',
        maTKGDBase: '003C1111111',
        accountType: 'FUTURES',
        ketLuan: { trangThai: 'KHOP', danhSachLoi: [] },
      },
      {
        _id: 'mismatch-id',
        maTKGD: '003C2222222',
        maTKGDBase: '003C2222222',
        accountType: 'FUTURES',
        ketLuan: { trangThai: 'LECH', danhSachLoi: ['mismatch'] },
      },
    ];

    const result = await createService(records).getRecords({
      limit: 20,
      page: 1,
      filter: 'KHOP',
    });

    expect(result.total).toBe(1);
    expect(result.items[0].maTKGDBase).toBe('003C1111111');
    expect(result.stats.totalCount).toBe(2);
    expect(result.stats.mismatchedCount).toBe(1);
  });

  it('promotes a matched record to CAN_KIEM_TRA for soft document warnings', async () => {
    const service = createService([{
      _id: 'warning-id',
      maTKGD: '003C3333333',
      maTKGDBase: '003C3333333',
      accountType: 'FUTURES',
      hopDong: { dinhDangLoi: ['missing signature'] },
      ketLuan: { trangThai: 'KHOP', danhSachLoi: [] },
    }]);

    const result = await service.getRecords({ limit: 20, page: 1 });

    expect(result.items[0].ketLuan.trangThai).toBe('CAN_KIEM_TRA');
    expect(result.items[0].ketLuan.danhSachLoi).toContain('missing signature');
  });

  it('applies search before grouping and pagination', async () => {
    const records = [
      {
        _id: 'search-hit',
        maTKGD: '003C4444444',
        maTKGDBase: '003C4444444',
        noiDungMail: { tenTaiKhoan: 'Tran Thi B' },
        ketLuan: { trangThai: 'KHOP', danhSachLoi: [] },
      },
    ];
    const service = createService(records);

    const result = await service.getRecords({
      limit: 1,
      page: 1,
      search: 'Tran Thi B',
    });

    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(1);
    expect(result.items[0].maTKGDBase).toBe('003C4444444');
  });
});
