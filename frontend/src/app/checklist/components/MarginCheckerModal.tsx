'use client';

import React, { useState, useEffect } from 'react';
import { X, FileSpreadsheet, Play, AlertTriangle, CheckCircle2, Info, Settings, ShieldAlert, Send, Download } from 'lucide-react';
import { API_BASE_URL } from '@/context/AuthContext';
import toast from 'react-hot-toast';

interface MarginCheckerModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftLogId: string;
  token: string;
}

export default function MarginCheckerModal({
  isOpen,
  onClose,
  shiftLogId,
  token,
}: MarginCheckerModalProps) {
  const [activeTab, setActiveTab] = useState<'onOrder' | 'changes' | 'config'>('onOrder');
  const [loading, setLoading] = useState(false);

  // Files for On-Order Check
  const [onOrderFiles, setOnOrderFiles] = useState<Record<string, File | null>>({
    futures: null,
    lme: null,
    acm: null,
    options: null,
    market: null,
    commodityConfig: null,
  });

  // Files for Change Check
  const [changeFiles, setChangeFiles] = useState<Record<string, File | null>>({
    cmeExcel: null,
    cmePdf: null,
    iceEUAg: null,
    iceSG: null,
    iceUS: null,
    bursaPdf: null,
    sgxExcel: null,
    jpxExcel: null,
    lmeExcel: null,
    futures: null,
    lmeMargin: null,
    options: null,
    commodityConfig: null,
  });

  // Configuration Settings State
  const [config, setConfig] = useState<any>({
    marginOnOrder: {
      warningRate: 20,
      isSendWarning: true,
      email: [],
      telegramChatId: '',
    },
    marginChange: {
      isSendWarning: true,
      email: [],
      telegramChatId: '',
    },
    smtp: {
      host: 'smtp.office365.com',
      port: 587,
      user: '',
      pass: '',
      senderEmail: '',
      senderName: '',
    },
  });

  const [emailInputs, setEmailInputs] = useState({
    onOrder: '',
    change: '',
  });

  // Result States
  const [onOrderResult, setOnOrderResult] = useState<any>(null);
  const [changeResult, setChangeResult] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/margin-checker/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (err: any) {
      toast.error('Không thể tải cấu hình Margin Checker');
    }
  };

  const saveConfig = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/margin-checker/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        toast.success('Cấu hình đã lưu thành công!');
        fetchConfig();
      } else {
        throw new Error('Lỗi lưu cấu hình');
      }
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  const handleFileChange = (
    type: 'onOrder' | 'change',
    key: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = e.target.files?.[0] || null;
    if (type === 'onOrder') {
      setOnOrderFiles(prev => ({ ...prev, [key]: selectedFile }));
    } else {
      setChangeFiles(prev => ({ ...prev, [key]: selectedFile }));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (type: 'onOrder' | 'change', key: string, e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0] || null;
    if (type === 'onOrder') {
      setOnOrderFiles(prev => ({ ...prev, [key]: droppedFile }));
    } else {
      setChangeFiles(prev => ({ ...prev, [key]: droppedFile }));
    }
  };

  // Run calculations
  const handleRunOnOrderCheck = async () => {
    if (!onOrderFiles.futures || !onOrderFiles.lme || !onOrderFiles.acm || !onOrderFiles.market) {
      toast.error('Vui lòng chọn đầy đủ các file bắt buộc: Futures, LME, ACM, và MarketData.');
      return;
    }

    const formData = new FormData();
    Object.entries(onOrderFiles).forEach(([key, file]) => {
      if (file) {
        formData.append(key, file);
      }
    });

    setLoading(true);
    setOnOrderResult(null);

    try {
      const res = await fetch(`${API_BASE_URL}/margin-checker/check-margin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Lỗi kiểm tra ký quỹ');
      }

      const data = await res.json();
      setOnOrderResult(data);
      if (data.warningCount > 0) {
        toast.error(`Phát hiện ${data.warningCount} hàng hóa vi phạm tỷ lệ mức ký quỹ!`);
      } else {
        toast.success('Kiểm tra hoàn thành: Không có vi phạm!');
      }
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRunChangeCheck = async () => {
    if (!changeFiles.cmeExcel || !changeFiles.cmePdf) {
      toast.error('Vui lòng tải lên cả hai file CME Excel và CME PDF.');
      return;
    }

    const formData = new FormData();
    Object.entries(changeFiles).forEach(([key, file]) => {
      if (file) {
        formData.append(key, file);
      }
    });

    setLoading(true);
    setChangeResult(null);

    try {
      const res = await fetch(`${API_BASE_URL}/margin-checker/check-change`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Lỗi kiểm tra thay đổi ký quỹ');
      }

      const data = await res.json();
      setChangeResult(data);
      if (data.warningCount > 0) {
        toast.error(`Phát hiện ${data.warningCount} hàng hóa thay đổi mức ký quỹ từ các Sở!`);
      } else {
        toast.success('Kiểm tra hoàn thành: Không phát hiện thay đổi nào!');
      }
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Excel Download Helper
  const downloadReport = (base64Data: string, filename: string) => {
    const binaryStr = window.atob(base64Data);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const renderFileDropzone = (
    type: 'onOrder' | 'change',
    key: string,
    label: string,
    required = false,
  ) => {
    const file = type === 'onOrder' ? onOrderFiles[key] : changeFiles[key];
    const acceptTypes = key.endsWith('Pdf') || key === 'cmePdf' ? '.pdf' : key === 'market' || key === 'jpxExcel' || key.startsWith('ice') ? '.xlsx,.xls,.csv' : '.xlsx,.xls';

    return (
      <div
        onDragOver={handleDragOver}
        onDrop={e => handleDrop(type, key, e)}
        style={{
          border: '1px dashed var(--border-color)',
          borderRadius: '10px',
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.01)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          position: 'relative',
          cursor: 'pointer',
          minHeight: '85px',
          transition: 'all 0.2s ease',
          borderColor: file ? 'var(--color-primary)' : 'var(--border-color)',
        }}
      >
        <input
          type="file"
          accept={acceptTypes}
          onChange={e => handleFileChange(type, key, e)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0,
            cursor: 'pointer',
            zIndex: 5,
          }}
        />
        <FileSpreadsheet size={22} color={file ? 'var(--color-primary)' : 'var(--text-muted)'} />
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center' }}>
          {label} {required && <span style={{ color: 'var(--color-critical)' }}>*</span>}
        </span>
        {file && (
          <span
            style={{
              fontSize: '0.7rem',
              color: 'var(--color-primary)',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: 500,
            }}
          >
            {file.name}
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      className="no-print"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '1200px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={24} color="var(--color-primary)" />
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Hệ thống Đối soát Biên ký quỹ (Margin Checker)
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                Di trú tự động hóa từ C# WinForms
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(0, 0, 0, 0.2)',
            borderBottom: '1px solid var(--border-color)',
            padding: '0 16px',
          }}
        >
          <button
            onClick={() => setActiveTab('onOrder')}
            style={{
              padding: '14px 20px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'onOrder' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === 'onOrder' ? 'var(--color-primary)' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Mức ký quỹ trên giá trị lệnh (On-Order)
          </button>
          <button
            onClick={() => setActiveTab('changes')}
            style={{
              padding: '14px 20px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'changes' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === 'changes' ? 'var(--color-primary)' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Thay đổi mức ký quỹ của Sở (Exchanges)
          </button>
          <button
            onClick={() => setActiveTab('config')}
            style={{
              padding: '14px 20px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'config' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === 'config' ? 'var(--color-primary)' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Settings size={14} /> Cấu hình cảnh báo
          </button>
        </div>

        {/* Tab Content area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {activeTab === 'onOrder' && (
            <div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '16px',
                  marginBottom: '20px',
                }}
              >
                {renderFileDropzone('onOrder', 'futures', 'DSHH Futures Excel', true)}
                {renderFileDropzone('onOrder', 'lme', 'DSHH LME Excel', true)}
                {renderFileDropzone('onOrder', 'acm', 'DSHH ACM Excel', true)}
                {renderFileDropzone('onOrder', 'options', 'DSHH Options Excel')}
                {renderFileDropzone('onOrder', 'market', 'MarketData CSV', true)}
                {renderFileDropzone('onOrder', 'commodityConfig', 'Commodity.xlsx (Cấu hình)')}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginBottom: '24px' }}>
                <button
                  onClick={handleRunOnOrderCheck}
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '150px' }}
                >
                  <Play size={16} />
                  {loading ? 'Đang phân tích...' : 'Bắt đầu quét'}
                </button>
              </div>

              {onOrderResult && (
                <div className="glass-panel" style={{ padding: '20px', border: '1px solid var(--border-color)' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '16px',
                      paddingBottom: '12px',
                      borderBottom: '1px solid var(--border-color)',
                    }}
                  >
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Kết quả quét mức ký quỹ / giá trị lệnh
                      </h3>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Lần cuối chạy: {onOrderResult.lastCheck}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span
                        className={`badge ${onOrderResult.warningCount > 0 ? 'badge-high' : 'badge-low'}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {onOrderResult.warningCount > 0 ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                        {onOrderResult.warningCount} hàng hóa vi phạm
                      </span>

                      <button
                        onClick={() => downloadReport(onOrderResult.excelReportBase64, onOrderResult.excelReportFilename)}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        <Download size={14} /> Tải báo cáo Excel
                      </button>
                    </div>
                  </div>

                  {/* Scrollable Results Table */}
                  <div style={{ overflowX: 'auto', maxHeight: '350px' }}>
                    <table className="checklist-table" style={{ width: '100%', fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th>Phiên GD</th>
                          <th>Mã hàng</th>
                          <th>Tên hàng</th>
                          <th>Sở GD</th>
                          <th style={{ textAlign: 'right' }}>Ký quỹ BD (Ex)</th>
                          <th style={{ textAlign: 'right' }}>Ký quỹ KH (1.2x)</th>
                          <th>Tệ</th>
                          <th style={{ textAlign: 'right' }}>GTT</th>
                          <th style={{ textAlign: 'right' }}>Tỷ lệ sau x1.2</th>
                          <th style={{ textAlign: 'right' }}>Giá trị HĐ</th>
                          <th style={{ textAlign: 'right' }}>Chênh MXV-Exchange</th>
                        </tr>
                      </thead>
                      <tbody>
                        {onOrderResult.data.map((item: any, idx: number) => {
                          const isWarning = item.MucKQSau < (config.marginOnOrder.warningRate / 100);
                          return (
                            <tr
                              key={idx}
                              style={{
                                background: isWarning ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                                borderLeft: isWarning ? '3px solid var(--color-critical)' : 'none',
                              }}
                            >
                              <td>{item.PhienGD}</td>
                              <td style={{ fontWeight: 700 }}>{item.MaHangHoa}</td>
                              <td>{item.TenHangHoa}</td>
                              <td>{item.SoGD}</td>
                              <td style={{ textAlign: 'right' }}>{item.KyQuyBD.toLocaleString('en-US')}</td>
                              <td style={{ textAlign: 'right' }}>{item.KyQuyKH.toLocaleString('en-US')}</td>
                              <td>{item.TienTe}</td>
                              <td style={{ textAlign: 'right' }}>{item.GTT.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                              <td
                                style={{
                                  textAlign: 'right',
                                  fontWeight: isWarning ? 700 : 'normal',
                                  color: isWarning ? 'var(--color-critical)' : 'var(--text-primary)',
                                }}
                              >
                                {(item.MucKQSau * 100).toFixed(2)}%
                              </td>
                              <td style={{ textAlign: 'right' }}>{item.GiaTriHH.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                              <td
                                style={{
                                  textAlign: 'right',
                                  color: item.ChenhMxvExchange < 0 ? 'var(--color-critical)' : 'var(--color-success)',
                                }}
                              >
                                {(item.ChenhMxvExchange * 100).toFixed(2)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'changes' && (
            <div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '16px',
                  marginBottom: '20px',
                }}
              >
                {renderFileDropzone('change', 'cmeExcel', 'CME Excel (Outright)', true)}
                {renderFileDropzone('change', 'cmePdf', 'CME Margin PDF (Maint)', true)}
                {renderFileDropzone('change', 'iceEUAg', 'ICE EU Ag CSV')}
                {renderFileDropzone('change', 'iceSG', 'ICE SG CSV')}
                {renderFileDropzone('change', 'iceUS', 'ICE US CSV')}
                {renderFileDropzone('change', 'bursaPdf', 'Bursa Margin PDF')}
                {renderFileDropzone('change', 'sgxExcel', 'SGX Margin Excel')}
                {renderFileDropzone('change', 'jpxExcel', 'JPX Margin CSV')}
                {renderFileDropzone('change', 'lmeExcel', 'LME Margin Excel')}
                {renderFileDropzone('change', 'futures', 'DSHH Futures (So sánh)')}
                {renderFileDropzone('change', 'lmeMargin', 'DSHH LME (So sánh)')}
                {renderFileDropzone('change', 'options', 'DSHH Options (So sánh)')}
                {renderFileDropzone('change', 'commodityConfig', 'Commodity.xlsx (Cấu hình)')}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginBottom: '24px' }}>
                <button
                  onClick={handleRunChangeCheck}
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '150px' }}
                >
                  <Play size={16} />
                  {loading ? 'Đang so sánh...' : 'Quét thay đổi'}
                </button>
              </div>

              {changeResult && (
                <div className="glass-panel" style={{ padding: '20px', border: '1px solid var(--border-color)' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '16px',
                      paddingBottom: '12px',
                      borderBottom: '1px solid var(--border-color)',
                    }}
                  >
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Danh sách thay đổi mức ký quỹ từ các Sở
                      </h3>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Lần cuối chạy: {changeResult.lastCheck}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span
                        className={`badge ${changeResult.warningCount > 0 ? 'badge-high' : 'badge-low'}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {changeResult.warningCount > 0 ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                        {changeResult.warningCount} mã thay đổi ký quỹ
                      </span>

                      <button
                        onClick={() => downloadReport(changeResult.excelReportBase64, changeResult.excelReportFilename)}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        <Download size={14} /> Tải báo cáo thay đổi
                      </button>
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto', maxHeight: '350px' }}>
                    <table className="checklist-table" style={{ width: '100%', fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th>STT</th>
                          <th>Tên hàng hóa</th>
                          <th>Mã hàng hóa</th>
                          <th>Nhóm hàng hóa</th>
                          <th>Sở giao dịch</th>
                          <th style={{ textAlign: 'right' }}>Mức ký quỹ mới</th>
                          <th>Tiền tệ</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {changeResult.data.map((item: any, idx: number) => (
                          <tr
                            key={idx}
                            style={{
                              background: item.IsNew ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                              borderLeft: item.IsNew ? '3px solid var(--color-primary)' : 'none',
                            }}
                          >
                            <td>{idx + 1}</td>
                            <td>{item.TenHangHoa}</td>
                            <td style={{ fontWeight: 700 }}>{item.MaHangHoa}</td>
                            <td>{item.NhomHH}</td>
                            <td>{item.SoGD}</td>
                            <td style={{ textAlign: 'right', fontWeight: item.IsNew ? 700 : 'normal' }}>
                              {item.KyQuy.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                            </td>
                            <td>{item.TienTe}</td>
                            <td>
                              {item.IsNew ? (
                                <span className="badge badge-high" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                                  THAY ĐỔI
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>Không đổi</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'config' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                {/* On Order Config */}
                <div className="glass-panel" style={{ padding: '20px', border: '1px solid var(--border-color)' }}>
                  <h3
                    style={{
                      margin: '0 0 16px 0',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      borderBottom: '1px solid var(--border-color)',
                      paddingBottom: '8px',
                    }}
                  >
                    Cảnh báo ký quỹ trên giá trị lệnh (On-Order)
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Ngưỡng cảnh báo (%)</span>
                      <input
                        type="number"
                        value={config.marginOnOrder.warningRate}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setConfig((prev: any) => ({
                            ...prev,
                            marginOnOrder: { ...prev.marginOnOrder, warningRate: val },
                          }));
                        }}
                        style={{
                          width: '80px',
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '0.8rem',
                          textAlign: 'right',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Kích hoạt gửi cảnh báo</span>
                      <input
                        type="checkbox"
                        checked={config.marginOnOrder.isSendWarning}
                        onChange={e => {
                          const checked = e.target.checked;
                          setConfig((prev: any) => ({
                            ...prev,
                            marginOnOrder: { ...prev.marginOnOrder, isSendWarning: checked },
                          }));
                        }}
                      />
                    </div>

                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Telegram Chat ID nhận cảnh báo
                      </span>
                      <input
                        type="text"
                        value={config.marginOnOrder.telegramChatId}
                        onChange={e => {
                          const val = e.target.value;
                          setConfig((prev: any) => ({
                            ...prev,
                            marginOnOrder: { ...prev.marginOnOrder, telegramChatId: val },
                          }));
                        }}
                        placeholder="Nhập chat ID Telegram"
                        style={{
                          width: '100%',
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          fontSize: '0.8rem',
                        }}
                      />
                    </div>

                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Email người nhận cảnh báo
                      </span>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input
                          type="email"
                          value={emailInputs.onOrder}
                          onChange={e => setEmailInputs(prev => ({ ...prev, onOrder: e.target.value }))}
                          placeholder="Thêm email nhận tin"
                          style={{
                            flex: 1,
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '0.8rem',
                          }}
                        />
                        <button
                          onClick={() => {
                            if (emailInputs.onOrder && !config.marginOnOrder.email.includes(emailInputs.onOrder)) {
                              setConfig((prev: any) => ({
                                ...prev,
                                marginOnOrder: {
                                  ...prev.marginOnOrder,
                                  email: [...prev.marginOnOrder.email, emailInputs.onOrder],
                                },
                              }));
                              setEmailInputs(prev => ({ ...prev, onOrder: '' }));
                            }
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                        >
                          Thêm
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {config.marginOnOrder.email.map((email: string, index: number) => (
                          <span
                            key={index}
                            style={{
                              fontSize: '0.75rem',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid var(--border-color)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            {email}
                            <button
                              onClick={() => {
                                setConfig((prev: any) => ({
                                  ...prev,
                                  marginOnOrder: {
                                    ...prev.marginOnOrder,
                                    email: prev.marginOnOrder.email.filter((e: string) => e !== email),
                                  },
                                }));
                              }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-critical)', padding: 0 }}
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Change Config */}
                <div className="glass-panel" style={{ padding: '20px', border: '1px solid var(--border-color)' }}>
                  <h3
                    style={{
                      margin: '0 0 16px 0',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      borderBottom: '1px solid var(--border-color)',
                      paddingBottom: '8px',
                    }}
                  >
                    Cảnh báo thay đổi mức ký quỹ (Exchanges)
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Kích hoạt gửi cảnh báo</span>
                      <input
                        type="checkbox"
                        checked={config.marginChange.isSendWarning}
                        onChange={e => {
                          const checked = e.target.checked;
                          setConfig((prev: any) => ({
                            ...prev,
                            marginChange: { ...prev.marginChange, isSendWarning: checked },
                          }));
                        }}
                      />
                    </div>

                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Telegram Chat ID nhận cảnh báo
                      </span>
                      <input
                        type="text"
                        value={config.marginChange.telegramChatId}
                        onChange={e => {
                          const val = e.target.value;
                          setConfig((prev: any) => ({
                            ...prev,
                            marginChange: { ...prev.marginChange, telegramChatId: val },
                          }));
                        }}
                        placeholder="Nhập chat ID Telegram"
                        style={{
                          width: '100%',
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          fontSize: '0.8rem',
                        }}
                      />
                    </div>

                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Email người nhận cảnh báo
                      </span>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input
                          type="email"
                          value={emailInputs.change}
                          onChange={e => setEmailInputs(prev => ({ ...prev, change: e.target.value }))}
                          placeholder="Thêm email nhận tin"
                          style={{
                            flex: 1,
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '0.8rem',
                          }}
                        />
                        <button
                          onClick={() => {
                            if (emailInputs.change && !config.marginChange.email.includes(emailInputs.change)) {
                              setConfig((prev: any) => ({
                                ...prev,
                                marginChange: {
                                  ...prev.marginChange,
                                  email: [...prev.marginChange.email, emailInputs.change],
                                },
                              }));
                              setEmailInputs(prev => ({ ...prev, change: '' }));
                            }
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                        >
                          Thêm
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {config.marginChange.email.map((email: string, index: number) => (
                          <span
                            key={index}
                            style={{
                              fontSize: '0.75rem',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid var(--border-color)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            {email}
                            <button
                              onClick={() => {
                                setConfig((prev: any) => ({
                                  ...prev,
                                  marginChange: {
                                    ...prev.marginChange,
                                    email: prev.marginChange.email.filter((e: string) => e !== email),
                                  },
                                }));
                              }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-critical)', padding: 0 }}
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SMTP configuration */}
              <div className="glass-panel" style={{ padding: '20px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                <h3
                  style={{
                    margin: '0 0 16px 0',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    borderBottom: '1px solid var(--border-color)',
                    paddingBottom: '8px',
                  }}
                >
                  Cấu hình kết nối Mail Server (SMTP)
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>SMTP Host</span>
                    <input
                      type="text"
                      value={config.smtp.host}
                      onChange={e => {
                        const val = e.target.value;
                        setConfig((prev: any) => ({ ...prev, smtp: { ...prev.smtp, host: val } }));
                      }}
                      style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '0.8rem',
                      }}
                    />
                  </div>

                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>SMTP Port</span>
                    <input
                      type="number"
                      value={config.smtp.port}
                      onChange={e => {
                        const val = parseInt(e.target.value) || 0;
                        setConfig((prev: any) => ({ ...prev, smtp: { ...prev.smtp, port: val } }));
                      }}
                      style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '0.8rem',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tên đăng nhập (Email)</span>
                    <input
                      type="text"
                      value={config.smtp.user}
                      onChange={e => {
                        const val = e.target.value;
                        setConfig((prev: any) => ({ ...prev, smtp: { ...prev.smtp, user: val } }));
                      }}
                      style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '0.8rem',
                      }}
                    />
                  </div>

                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Mật khẩu</span>
                    <input
                      type="password"
                      value={config.smtp.pass}
                      onChange={e => {
                        const val = e.target.value;
                        setConfig((prev: any) => ({ ...prev, smtp: { ...prev.smtp, pass: val } }));
                      }}
                      style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '0.8rem',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Email người gửi (From)</span>
                    <input
                      type="email"
                      value={config.smtp.senderEmail}
                      onChange={e => {
                        const val = e.target.value;
                        setConfig((prev: any) => ({ ...prev, smtp: { ...prev.smtp, senderEmail: val } }));
                      }}
                      style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '0.8rem',
                      }}
                    />
                  </div>

                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tên người gửi (From Name)</span>
                    <input
                      type="text"
                      value={config.smtp.senderName}
                      onChange={e => {
                        const val = e.target.value;
                        setConfig((prev: any) => ({ ...prev, smtp: { ...prev.smtp, senderName: val } }));
                      }}
                      style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '0.8rem',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={saveConfig}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Send size={16} /> Lưu cấu hình
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
