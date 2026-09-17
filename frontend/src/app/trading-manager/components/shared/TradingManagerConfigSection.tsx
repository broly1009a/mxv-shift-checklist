'use client';

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  Clock,
  Folder,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
  Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '@/context/AuthContext';

export interface TradingManagerConfigSectionProps {
  token: string | null;
}

export default function TradingManagerConfigSection({
  token,
}: TradingManagerConfigSectionProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Exchange rates
  const [usdSettlementRateSell, setUsdSettlementRateSell] = useState<number>(26100);
  const [usdSettlementRateBuy, setUsdSettlementRateBuy] = useState<number>(26100);
  const [usdExchangeRate, setUsdExchangeRate] = useState<number>(26100);
  const [currencyUnit, setCurrencyUnit] = useState<string>('USD/VND');

  // Session time
  const [sessionStartTime, setSessionStartTime] = useState<string>('05:00');
  const [sessionEndTime, setSessionEndTime] = useState<string>('05:00');

  // 10 Paths + 2 CoreCCP paths
  const [reconFolderCheckPath, setReconFolderCheckPath] = useState<string>('');
  const [reconResultFolderPath, setReconResultFolderPath] = useState<string>('');
  const [morningMsDataPath, setMorningMsDataPath] = useState<string>('');
  const [gttImportPath, setGttImportPath] = useState<string>('');
  const [botBackupPathCqg, setBotBackupPathCqg] = useState<string>('');
  const [botBackupPathMs, setBotBackupPathMs] = useState<string>('');
  const [botBackupPathAcm, setBotBackupPathAcm] = useState<string>('');
  const [botLotMacroPath, setBotLotMacroPath] = useState<string>('');
  const [botMacroValuePath, setBotMacroValuePath] = useState<string>('');
  const [newsTeamStatPath, setNewsTeamStatPath] = useState<string>('');
  const [botBackupPathCcp, setBotBackupPathCcp] = useState<string>('');
  const [botBackupPathCe, setBotBackupPathCe] = useState<string>('');

  // Path check statuses
  const [pathChecking, setPathChecking] = useState<Record<string, boolean>>({});
  const [pathStatus, setPathStatus] = useState<Record<string, { ok: boolean; msg: string }>>({});

  // Negative Margin Monitored Accounts
  const [negativeAccounts, setNegativeAccounts] = useState<string[]>([]);
  const [selectedAccIndex, setSelectedAccIndex] = useState<number | null>(null);
  const [newAccInput, setNewAccInput] = useState<string>('');

  // LME Holidays mapping (Original Date -> Replacement Date)
  const [lmeHolidays, setLmeHolidays] = useState<Array<{ originalDate: string; replacementDate: string }>>([]);
  const [newLmeOriginal, setNewLmeOriginal] = useState<string>('');
  const [newLmeReplacement, setNewLmeReplacement] = useState<string>('');

  // Fetch full configuration from Database (MongoDB system_settings)
  const fetchConfig = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/system-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`Lỗi tải cấu hình (HTTP ${res.status})`);
      }
      const settingsList: Array<{ key: string; value: string }> = await res.json();
      const map: Record<string, string> = {};
      if (Array.isArray(settingsList)) {
        settingsList.forEach((item) => {
          if (item?.key) map[item.key] = item.value;
        });
      }

      setUsdSettlementRateSell(Number(map.usd_settlement_rate_sell || map.usd_exchange_rate || 26100));
      setUsdSettlementRateBuy(Number(map.usd_settlement_rate_buy || map.usd_exchange_rate || 26100));
      setUsdExchangeRate(Number(map.usd_exchange_rate || 26100));
      setSessionStartTime(map.session_start_time || '05:00');
      setSessionEndTime(map.session_end_time || '05:00');

      setReconFolderCheckPath(map.recon_folder_check_path || '');
      setReconResultFolderPath(map.recon_result_folder_path || '');
      setMorningMsDataPath(map.morning_ms_data_path || '');
      setGttImportPath(map.gtt_import_path || '');
      setBotBackupPathCqg(map.bot_backup_path_cqg || '');
      setBotBackupPathMs(map.bot_backup_path_ms || '');
      setBotBackupPathAcm(map.bot_backup_path_acm || '');
      setBotLotMacroPath(map.bot_macro_lot_path || map.bot_lot_macro_path || '');
      setBotMacroValuePath(map.bot_macro_value_path || '');
      setNewsTeamStatPath(map.news_team_stat_path || '');
      setBotBackupPathCcp(map.bot_backup_path_ccp || '');
      setBotBackupPathCe(map.bot_backup_path_ce || '');

      if (map.negative_margin_monitored_accounts) {
        try {
          setNegativeAccounts(JSON.parse(map.negative_margin_monitored_accounts));
        } catch {
          setNegativeAccounts([]);
        }
      }
      if (map.lme_holiday_replacements) {
        try {
          setLmeHolidays(JSON.parse(map.lme_holiday_replacements));
        } catch {
          setLmeHolidays([]);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Không thể tải cấu hình từ CSDL');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [token]);

  // Save full configuration directly to MongoDB system_settings (Bot Config)
  const handleSaveConfig = async () => {
    if (!token) return;
    setSaving(true);
    const toastId = toast.loading('Đang lưu cấu hình & đường dẫn vào CSDL MongoDB...');

    try {
      const settingsToSave: Array<{ key: string; value: string }> = [
        { key: 'usd_settlement_rate_sell', value: String(usdSettlementRateSell) },
        { key: 'usd_settlement_rate_buy', value: String(usdSettlementRateBuy) },
        { key: 'usd_exchange_rate', value: String(usdExchangeRate) },
        { key: 'session_start_time', value: sessionStartTime },
        { key: 'session_end_time', value: sessionEndTime },
        { key: 'recon_folder_check_path', value: reconFolderCheckPath },
        { key: 'recon_result_folder_path', value: reconResultFolderPath },
        { key: 'morning_ms_data_path', value: morningMsDataPath },
        { key: 'gtt_import_path', value: gttImportPath },
        { key: 'bot_backup_path_cqg', value: botBackupPathCqg },
        { key: 'bot_backup_path_ms', value: botBackupPathMs },
        { key: 'bot_backup_path_acm', value: botBackupPathAcm },
        { key: 'bot_macro_lot_path', value: botLotMacroPath },
        { key: 'bot_lot_macro_path', value: botLotMacroPath },
        { key: 'bot_macro_value_path', value: botMacroValuePath },
        { key: 'news_team_stat_path', value: newsTeamStatPath },
        { key: 'bot_backup_path_ccp', value: botBackupPathCcp },
        { key: 'bot_backup_path_ce', value: botBackupPathCe },
        { key: 'negative_margin_monitored_accounts', value: JSON.stringify(negativeAccounts) },
        { key: 'lme_holiday_replacements', value: JSON.stringify(lmeHolidays) },
      ];

      await Promise.all(
        settingsToSave.map((s) =>
          fetch(`${API_BASE_URL}/api/v1/system-settings`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(s),
          }),
        ),
      );

      toast.success('Đã lưu cấu hình thành công vào CSDL MongoDB (Bot Config)!', { id: toastId });
    } catch (err: any) {
      toast.error(`Lỗi khi lưu cấu hình: ${err.message}`, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  // Verify storage path on server
  const handleVerifyPath = async (key: string, targetPath: string) => {
    if (!token || !targetPath.trim()) return;
    setPathChecking((prev) => ({ ...prev, [key]: true }));

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/system-settings/verify-storage-path`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: targetPath.trim(), targetType: 'any' }),
      });

      const data = await res.json();
      setPathStatus((prev) => ({
        ...prev,
        [key]: {
          ok: !!data.canWrite || !!data.exists,
          msg: data.message || (data.exists ? 'Đường dẫn hợp lệ' : 'Đường dẫn không tồn tại'),
        },
      }));
    } catch (err: any) {
      setPathStatus((prev) => ({
        ...prev,
        [key]: { ok: false, msg: `Lỗi kết nối kiểm tra: ${err.message}` },
      }));
    } finally {
      setPathChecking((prev) => ({ ...prev, [key]: false }));
    }
  };

  // Add negative margin account
  const handleAddAccount = () => {
    const acc = newAccInput.trim().toUpperCase();
    if (!acc) return;
    if (negativeAccounts.includes(acc)) {
      toast.error('Mã tài khoản đã tồn tại trong danh sách');
      return;
    }
    setNegativeAccounts([...negativeAccounts, acc]);
    setNewAccInput('');
  };

  // Remove selected negative account
  const handleRemoveAccount = () => {
    if (selectedAccIndex === null || selectedAccIndex >= negativeAccounts.length) return;
    const updated = negativeAccounts.filter((_, idx) => idx !== selectedAccIndex);
    setNegativeAccounts(updated);
    setSelectedAccIndex(null);
  };

  // Add LME Holiday replacement
  const handleAddLmeHoliday = () => {
    const orig = newLmeOriginal.trim();
    const rep = newLmeReplacement.trim();
    if (!orig || !rep) {
      toast.error('Vui lòng nhập đầy đủ Ngày gốc và Ngày thay thế (dd/MM/yyyy)');
      return;
    }
    setLmeHolidays([...lmeHolidays, { originalDate: orig, replacementDate: rep }]);
    setNewLmeOriginal('');
    setNewLmeReplacement('');
  };

  // Remove LME Holiday
  const handleRemoveLmeHoliday = (index: number) => {
    setLmeHolidays(lmeHolidays.filter((_, idx) => idx !== index));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* HEADER ACTION BAR */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sliders size={20} color="#10b981" />
          <div>
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Cấu Hình & Đường Dẫn Hệ Thống Đối Soát
            </h3>
            <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Đồng bộ trực tiếp với CSDL MongoDB – Thay đổi có hiệu lực ngay lập tức cho toàn bộ các Robot
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={fetchConfig}
            disabled={loading}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Tải Lại</span>
          </button>
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={saving}
            className="btn btn-primary"
            style={{ fontSize: '0.82rem', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 700 }}
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            <span>{saving ? 'Đang lưu...' : 'Lưu Cấu Hình'}</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: CẤU HÌNH TỶ GIÁ & PHIÊN GIAO DỊCH (1:1 C# Layout) */}
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {/* Cụm 1: Cấu hình tỷ giá */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <DollarSign size={16} color="#10b981" />
              <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Cấu hình tỷ giá
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
              {/* Cụm trái: Tỷ giá thanh toán */}
              <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-input)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Tỷ giá thanh toán
                  </span>
                  <select
                    value={currencyUnit}
                    onChange={(e) => setCurrencyUnit(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.75rem', padding: '2px 6px', height: '26px' }}
                  >
                    <option value="USD/VND">USD/VND</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Bán:</label>
                    <input
                      type="number"
                      value={usdSettlementRateSell}
                      onChange={(e) => setUsdSettlementRateSell(Number(e.target.value))}
                      className="form-input"
                      style={{ fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700, textAlign: 'right' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Mua:</label>
                    <input
                      type="number"
                      value={usdSettlementRateBuy}
                      onChange={(e) => setUsdSettlementRateBuy(Number(e.target.value))}
                      className="form-input"
                      style={{ fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700, textAlign: 'right' }}
                    />
                  </div>
                </div>
              </div>

              {/* Cụm phải: Tỷ giá quy đổi */}
              <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-input)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Tỷ giá quy đổi
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>USD/VND</span>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Quy đổi:</label>
                  <input
                    type="number"
                    value={usdExchangeRate}
                    onChange={(e) => setUsdExchangeRate(Number(e.target.value))}
                    className="form-input"
                    style={{ fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700, textAlign: 'right' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Cụm 2: Cấu hình phiên giao dịch */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <Clock size={16} color="#10b981" />
              <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Cấu hình phiên giao dịch
              </span>
            </div>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginTop: '12px' }}>
              <div style={{ flex: 1, padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-input)' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Bắt đầu phiên:
                </label>
                <input
                  type="time"
                  value={sessionStartTime}
                  onChange={(e) => setSessionStartTime(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', fontSize: '0.85rem', fontFamily: 'monospace', fontWeight: 700, textAlign: 'center' }}
                />
              </div>

              <div style={{ flex: 1, padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-input)' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Kết thúc phiên:
                </label>
                <input
                  type="time"
                  value={sessionEndTime}
                  onChange={(e) => setSessionEndTime(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', fontSize: '0.85rem', fontFamily: 'monospace', fontWeight: 700, textAlign: 'center' }}
                />
              </div>
            </div>
            <p style={{ margin: '10px 0 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              * Mốc giờ bắt đầu phiên được dùng để lọc loại trừ các lệnh xuyên đêm (T-1) khi đối soát khớp lệnh và đối chiếu EOD.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 2: HAI BẢNG SONG SONG (DANH SÁCH TK ÂM KQ & NGÀY NGHỈ LME) */}
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {/* Bảng Trái: Danh sách TKGD âm KQ */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} color="#ef4444" />
                <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Danh sách TKGD âm KQ
                </span>
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {negativeAccounts.length} tài khoản
              </span>
            </div>

            {/* ListBox hiển thị mã TK */}
            <div
              style={{
                height: '140px',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-input)',
                overflowY: 'auto',
                padding: '6px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))',
                gap: '4px',
                alignContent: 'start',
              }}
            >
              {negativeAccounts.map((acc, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedAccIndex(selectedAccIndex === idx ? null : idx)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.76rem',
                    fontFamily: 'monospace',
                    cursor: 'pointer',
                    backgroundColor: selectedAccIndex === idx ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                    color: selectedAccIndex === idx ? '#ef4444' : 'var(--text-primary)',
                    fontWeight: selectedAccIndex === idx ? 800 : 500,
                    border: selectedAccIndex === idx ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid transparent',
                    userSelect: 'none',
                    textAlign: 'center',
                  }}
                >
                  {acc}
                </div>
              ))}
            </div>

            {/* Add / Remove Controls */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <input
                type="text"
                placeholder="Mã TK mới (vd: 003C...)"
                value={newAccInput}
                onChange={(e) => setNewAccInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddAccount()}
                className="form-input"
                style={{ flex: 1, fontSize: '0.78rem', fontFamily: 'monospace' }}
              />
              <button
                type="button"
                onClick={handleAddAccount}
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={13} />
                <span>Thêm</span>
              </button>
              <button
                type="button"
                onClick={handleRemoveAccount}
                disabled={selectedAccIndex === null}
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px', color: selectedAccIndex !== null ? '#ef4444' : 'inherit' }}
              >
                <Trash2 size={13} />
                <span>Xóa</span>
              </button>
            </div>
          </div>

          {/* Bảng Phải: Danh sách ngày nghỉ LME */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} color="#3b82f6" />
                <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Danh sách ngày nghỉ LME
                </span>
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {lmeHolidays.length} ngày mapping
              </span>
            </div>

            {/* Bảng Ngày gốc | Ngày thay thế */}
            <div
              style={{
                height: '140px',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-input)',
                overflowY: 'auto',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: 'rgba(0,0,0,0.06)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '6px 10px', fontWeight: 700, width: '45%' }}>Ngày gốc</th>
                    <th style={{ padding: '6px 10px', fontWeight: 700, width: '45%' }}>Ngày thay thế</th>
                    <th style={{ padding: '6px 10px', width: '10%', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lmeHolidays.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Chưa có ngày nghỉ LME được cấu hình
                      </td>
                    </tr>
                  ) : (
                    lmeHolidays.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', fontFamily: 'monospace' }}>
                        <td style={{ padding: '5px 10px' }}>{item.originalDate}</td>
                        <td style={{ padding: '5px 10px' }}>{item.replacementDate}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveLmeHoliday(idx)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                            title="Xóa mapping này"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Add Holiday mapping */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <input
                type="text"
                placeholder="Ngày gốc (dd/MM/yyyy)"
                value={newLmeOriginal}
                onChange={(e) => setNewLmeOriginal(e.target.value)}
                className="form-input"
                style={{ flex: 1, fontSize: '0.76rem', fontFamily: 'monospace' }}
              />
              <input
                type="text"
                placeholder="Ngày thay thế (dd/MM/yyyy)"
                value={newLmeReplacement}
                onChange={(e) => setNewLmeReplacement(e.target.value)}
                className="form-input"
                style={{ flex: 1, fontSize: '0.76rem', fontFamily: 'monospace' }}
              />
              <button
                type="button"
                onClick={handleAddLmeHoliday}
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={13} />
                <span>Thêm</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: CÁC ĐƯỜNG DẪN HOẠT ĐỘNG THỰC TẾ (HỆ THỐNG SỬ DỤNG) */}
      <div className="glass-panel" style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Folder size={18} color="#10b981" />
            <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Đường Dẫn Thư Mục Backup & Thống Kê Hoạt Động
            </h4>
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            7 đường dẫn đang hoạt động trong hệ thống
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[
            {
              id: 'botBackupPathMs',
              label: 'Đường dẫn backup M-System (Futures)',
              val: botBackupPathMs,
              setVal: setBotBackupPathMs,
              desc: 'Thư mục gốc lưu trữ 20 báo cáo tải về từ M-System (DSGD, TTM, TTTT, DSQLKQ...)',
            },
            {
              id: 'botBackupPathCqg',
              label: 'Đường dẫn backup CQG (Futures)',
              val: botBackupPathCqg,
              setVal: setBotBackupPathCqg,
              desc: 'Thư mục gốc lưu trữ 9 báo cáo thô tải về từ CQG (FR, PS, OP, OD, AS...)',
            },
            {
              id: 'botBackupPathAcm',
              label: 'Đường dẫn backup ACM (Straits)',
              val: botBackupPathAcm,
              setVal: setBotBackupPathAcm,
              desc: 'Thư mục lưu trữ file Straits CSV giao dịch khớp lệnh ACM Nano',
            },
            {
              id: 'botBackupPathCcp',
              label: 'Đường dẫn backup CoreCCP (VNCLEAR)',
              val: botBackupPathCcp,
              setVal: setBotBackupPathCcp,
              desc: 'Thư mục lưu trữ 8 báo cáo chuẩn từ hệ thống bù trừ thanh toán CoreCCP (DSGD, TTM, TTTT...)',
            },
            {
              id: 'botBackupPathCe',
              label: 'Đường dẫn backup CoreEX (Giao Dịch Mới)',
              val: botBackupPathCe,
              setVal: setBotBackupPathCe,
              desc: 'Thư mục lưu trữ báo cáo từ hệ thống giao dịch CoreEX',
            },
            {
              id: 'botLotMacroPath',
              label: 'Đường dẫn Macro thống kê số lot giao dịch',
              val: botLotMacroPath,
              setVal: setBotLotMacroPath,
              desc: 'Đường dẫn file Excel Macro tổng hợp số lot giao dịch hàng ngày (Macro thong ke so lot...)',
            },
            {
              id: 'botMacroValuePath',
              label: 'Đường dẫn Macro thống kê giá trị giao dịch',
              val: botMacroValuePath,
              setVal: setBotMacroValuePath,
              desc: 'Đường dẫn file Excel Macro tính toán tổng giá trị giao dịch thị trường (Macro thong ke gia tri...)',
            },
          ].map((item) => {
            const status = pathStatus[item.id];
            const isChecking = !!pathChecking[item.id];
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <label style={{ fontSize: '0.81rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {item.label}:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {status && (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontFamily: 'monospace',
                          color: status.ok ? '#10b981' : '#ef4444',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {status.ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                        {status.msg}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleVerifyPath(item.id, item.val)}
                      disabled={isChecking || !item.val.trim()}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.72rem', padding: '3px 10px', height: '26px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      {isChecking ? <Loader2 size={11} className="animate-spin" /> : <Folder size={11} />}
                      <span>Kiểm tra</span>
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={item.val}
                  onChange={(e) => item.setVal(e.target.value)}
                  className="form-input"
                  placeholder="M:\..."
                  style={{
                    fontSize: '0.8rem',
                    fontFamily: 'monospace',
                    padding: '8px 12px',
                    borderColor: status ? (status.ok ? '#10b981' : '#ef4444') : undefined,
                  }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.desc}</span>
              </div>
            );
          })}
        </div>

        {/* NÚT LƯU CẤU HÌNH LỚN TRUNG TÂM */}
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={saving}
            className="btn btn-primary"
            style={{
              minWidth: '260px',
              fontSize: '0.92rem',
              padding: '12px 32px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
            }}
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            <span>{saving ? 'Đang Lưu Cấu Hình...' : 'Lưu Cấu Hình'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
