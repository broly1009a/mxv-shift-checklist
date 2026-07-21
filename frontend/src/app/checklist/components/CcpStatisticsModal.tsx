'use client';

import React, { useState, useEffect } from 'react';
import { X, FileSpreadsheet, Play, Settings, Save, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '@/context/AuthContext';
import toast from 'react-hot-toast';

interface CcpStatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
}

export default function CcpStatisticsModal({
  isOpen,
  onClose,
  token,
}: CcpStatisticsModalProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'config'>('upload');
  
  // Files State
  const [files, setFiles] = useState<Record<string, File | null>>({
    dsgdCcp: null,
    dsgdMmCcp: null,
    dstkgd: null,
    nr: null,
    ttm: null,
    tttt: null,
  });

  // Date State
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Configuration State
  const [fixedMembers, setFixedMembers] = useState<string>('');
  const [tkMmCodes, setTkMmCodes] = useState<string>('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load config when open
  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/ccp-statistics/config`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setFixedMembers((data.fixedMembers || []).join(', '));
        setTkMmCodes((data.tkMmCodes || []).join(', '));
      }
    } catch (err: any) {
      console.error('Lỗi khi tải cấu hình CCP:', err);
    }
  };

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      const arrayFixed = fixedMembers.split(',').map(s => s.trim()).filter(Boolean);
      const arrayMm = tkMmCodes.split(',').map(s => s.trim()).filter(Boolean);

      const res = await fetch(`${API_BASE_URL}/ccp-statistics/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fixedMembers: arrayFixed,
          tkMmCodes: arrayMm,
        }),
      });

      if (!res.ok) {
        throw new Error('Lỗi khi lưu cấu hình CCP');
      }

      toast.success('Đã lưu cấu hình danh sách Thành viên & Tài khoản MM thành công!');
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  if (!isOpen) return null;

  const handleFileChange = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFiles(prev => ({ ...prev, [key]: selectedFile }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (key: string, e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0] || null;
    setFiles(prev => ({ ...prev, [key]: droppedFile }));
  };

  const downloadFileFromBase64 = (base64Data: string, fileName: string) => {
    try {
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error('Lỗi khi tải file:', e);
      toast.error('Lỗi khi tải file về máy!');
    }
  };

  const handleRunProcess = async () => {
    // Validate required files
    if (!files.dsgdCcp || !files.dsgdMmCcp || !files.dstkgd || !files.nr || !files.ttm) {
      toast.error('Vui lòng chọn đủ 5 file bắt buộc (*)!');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('reportDate', selectedDate);
      formData.append('dsgdCcp', files.dsgdCcp);
      formData.append('dsgdMmCcp', files.dsgdMmCcp);
      formData.append('dstkgd', files.dstkgd);
      formData.append('nr', files.nr);
      formData.append('ttm', files.ttm);
      if (files.tttt) {
        formData.append('tttt', files.tttt);
      }

      const res = await fetch(`${API_BASE_URL}/ccp-statistics/process`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Lỗi khi xử lý gom nhóm báo cáo CCP');
      }

      const data = await res.json();
      toast.success('Báo cáo CCP đã gom nhóm thành công! Đang tải file về...');

      if (data.fileBase64 && data.fileName) {
        downloadFileFromBase64(data.fileBase64, data.fileName);
      }
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderDropzone = (key: string, label: string, desc: string, required: boolean = true) => {
    const file = files[key];
    return (
      <div
        onDragOver={handleDragOver}
        onDrop={e => handleDrop(key, e)}
        style={{
          border: file ? '1px solid #10b981' : '1px dashed rgba(255, 255, 255, 0.15)',
          borderRadius: '12px',
          padding: '16px',
          backgroundColor: file ? 'rgba(16, 185, 129, 0.05)' : 'rgba(15, 23, 42, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          position: 'relative',
          cursor: 'pointer',
          minHeight: '100px',
          transition: 'all 0.2s',
        }}
      >
        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={e => handleFileChange(key, e)}
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
        <FileSpreadsheet size={24} color={file ? '#10b981' : '#64748b'} />
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', textAlign: 'center' }}>
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </span>
        <span style={{
          fontSize: '0.7rem',
          color: file ? '#34d399' : '#94a3b8',
          textAlign: 'center',
          wordBreak: 'break-all',
          lineHeight: 1.3,
        }}>
          {file ? file.name : desc}
        </span>
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '24px',
    }}>
      <div style={{
        backgroundColor: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '960px',
        maxHeight: '88vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 28px',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            <div style={{
              padding: '10px',
              borderRadius: '12px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <FileSpreadsheet size={22} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#f8fafc',
                margin: 0,
                lineHeight: 1.4,
              }}>
                Báo cáo & Thống kê CCP
              </h2>
              <p style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                margin: '3px 0 0 0',
                lineHeight: 1.3,
              }}>
                Xử lý gom nhóm và kết xuất báo cáo Pilot Bạc Thỏi
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            style={{
              padding: '8px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '0 28px',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setActiveTab('upload')}
            style={{
              padding: '12px 20px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              borderBottom: activeTab === 'upload' ? '2px solid #10b981' : '2px solid transparent',
              color: activeTab === 'upload' ? '#10b981' : '#94a3b8',
              backgroundColor: activeTab === 'upload' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              marginBottom: '-1px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
            }}
          >
            <FileSpreadsheet size={16} />
            Nhập File Báo cáo
          </button>
          <button
            onClick={() => setActiveTab('config')}
            style={{
              padding: '12px 20px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              borderBottom: activeTab === 'config' ? '2px solid #10b981' : '2px solid transparent',
              color: activeTab === 'config' ? '#10b981' : '#94a3b8',
              backgroundColor: activeTab === 'config' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              marginBottom: '-1px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
            }}
          >
            <Settings size={16} />
            Cấu hình Thành viên & MM
          </button>
        </div>

        {/* Main Content Area */}
        <div style={{
          padding: '24px 28px',
          flex: 1,
          overflowY: 'auto',
          backgroundColor: 'rgba(15, 23, 42, 0.2)',
        }}>
          {activeTab === 'upload' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Date Input */}
              <div style={{
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap' }}>
                  Ngày chạy báo cáo:
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  style={{
                    backgroundColor: '#020617',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    color: '#f8fafc',
                    fontSize: '0.8rem',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Grid 6 dropzones */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                {renderDropzone('dsgdCcp', 'File DSGD CCP', 'Báo cáo danh sách giao dịch CCP')}
                {renderDropzone('dsgdMmCcp', 'File DSGD MM CCP', 'Báo cáo danh sách giao dịch MM')}
                {renderDropzone('dstkgd', 'File DSTKGD', 'Danh sách tài khoản giao dịch')}
                {renderDropzone('nr', 'File Nộp Rút (NR)', 'Báo cáo nộp rút tiền thành viên')}
                {renderDropzone('ttm', 'File TTM', 'Báo cáo trạng thái mở')}
                {renderDropzone('tttt', 'File TTTT (Tùy chọn)', 'Báo cáo thanh toán thực tế', false)}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
                  Danh sách Thành viên cố định (Fixed Members)
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
                  Nhập mã thành viên phân cách bởi dấu phẩy (Ví dụ: 001, 002, 003)
                </p>
                <input
                  type="text"
                  value={fixedMembers}
                  onChange={e => setFixedMembers(e.target.value)}
                  placeholder="001, 002, 005..."
                  style={{
                    backgroundColor: '#020617',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#f8fafc',
                    fontSize: '0.8rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
                  Danh sách Tài khoản MM (Market Maker Codes)
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
                  Nhập mã tài khoản MM phân cách bởi dấu phẩy (Ví dụ: 001C111111, 002C222222)
                </p>
                <input
                  type="text"
                  value={tkMmCodes}
                  onChange={e => setTkMmCodes(e.target.value)}
                  placeholder="001C123456, 002C654321..."
                  style={{
                    backgroundColor: '#020617',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#f8fafc',
                    fontSize: '0.8rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 28px',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            {activeTab === 'upload' ? 'Đảm bảo dữ liệu các file Excel đúng định dạng báo cáo gốc.' : 'Cấu hình này sẽ được áp dụng cho mọi lượt đối soát tiếp theo.'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {activeTab === 'upload' ? (
              <button
                onClick={handleRunProcess}
                disabled={loading}
                style={{
                  padding: '9px 24px',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                }}
              >
                {loading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Đang gom nhóm...
                  </>
                ) : (
                  <>
                    <Play size={14} fill="currentColor" />
                    Chạy gom nhóm báo cáo
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleSaveConfig}
                disabled={isSavingConfig}
                style={{
                  padding: '9px 24px',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  cursor: isSavingConfig ? 'not-allowed' : 'pointer',
                  opacity: isSavingConfig ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                }}
              >
                <Save size={14} />
                Lưu cấu hình
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                padding: '9px 20px',
                backgroundColor: '#1e293b',
                color: '#e2e8f0',
                borderRadius: '10px',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: '1px solid #334155',
                cursor: 'pointer',
              }}
            >
              Đóng
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
