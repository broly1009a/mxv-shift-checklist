'use client';

import React, { useState, useEffect } from 'react';
import { X, Play, AlertCircle, CheckCircle2, XCircle, Clock, Database, RefreshCw, Terminal, Copy } from 'lucide-react';
import { API_BASE_URL } from '@/context/AuthContext';
import toast from 'react-hot-toast';

interface OmsStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  shiftLogId: string;
  taskId: string;
  taskName: string;
  resultNote: string | null;
  status: string;
  onTaskUpdated?: () => void;
}

export default function OmsStatusModal({
  isOpen,
  onClose,
  token,
  shiftLogId,
  taskId,
  taskName,
  resultNote,
  status,
  onTaskUpdated,
}: OmsStatusModalProps) {
  const [activeTab, setActiveTab] = useState<'status' | 'logs'>('status');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Parse resultNote
  let parsedNote: any = null;
  let isJson = false;
  if (resultNote) {
    try {
      parsedNote = JSON.parse(resultNote);
      isJson = true;
    } catch {
      parsedNote = { message: resultNote };
    }
  }

  // Poll for status updates if bot is WAITING
  useEffect(() => {
    let intervalId: any;
    if (isOpen && status === 'WAITING' && onTaskUpdated) {
      intervalId = setInterval(() => {
        onTaskUpdated();
      }, 5000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isOpen, status, onTaskUpdated]);

  if (!isOpen) return null;

  const handleTriggerCheck = async () => {
    setLoading(true);
    try {
      const endpoint = taskId === 'ops_open_07' 
        ? `${API_BASE_URL}/api/v1/bot-engine/trigger-email-check/${shiftLogId}/${taskId}`
        : `${API_BASE_URL}/api/v1/bot-engine/trigger-oms-check/${shiftLogId}/${taskId}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Lỗi khi gửi yêu cầu kích hoạt Robot');
      }

      toast.success('Đã gửi yêu cầu kích hoạt Robot tự động!');
      if (onTaskUpdated) onTaskUpdated();
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLogs = () => {
    if (!resultNote) return;
    navigator.clipboard.writeText(resultNote);
    setCopied(true);
    toast.success('Đã sao chép dữ liệu JSON!');
    setTimeout(() => setCopied(false), 2000);
  };

  const checkTime = parsedNote?.timestamp 
    ? new Date(parsedNote.timestamp).toLocaleTimeString('vi-VN') 
    : null;

  const ccpData = parsedNote?.data?.ccp;
  const ceData = parsedNote?.data?.ce;
  const emailData = taskId === 'ops_open_07' ? parsedNote?.data : null;

  const isOps07 = taskId === 'ops_open_07';
  const themeColor = isOps07 ? '#3b82f6' : '#ec4899';
  const themeBg = isOps07 ? 'rgba(59, 130, 246, 0.1)' : 'rgba(236, 72, 153, 0.1)';
  const themeBorder = isOps07 ? 'rgba(59, 130, 246, 0.25)' : 'rgba(236, 72, 153, 0.25)';

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
        maxWidth: '920px',
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
              backgroundColor: themeBg,
              border: `1px solid ${themeBorder}`,
              color: themeColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Database size={22} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#f8fafc',
                margin: 0,
                lineHeight: 1.4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {taskName || (isOps07 ? 'Kiểm tra Job Snapshot (07h00)' : 'Kiểm tra EOD OMS & lệnh MM OMS (05h00)')}
              </h2>
              <p style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                margin: '3px 0 0 0',
                lineHeight: 1.3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {isOps07
                  ? 'Xác minh lịch sử gửi email sao kê tự động qua Playwright Robot'
                  : 'Kiểm tra kết quả EOD & Lệnh MM tự động qua Playwright Robot'}
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
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Status Alert Banner */}
        <div style={{
          padding: '12px 28px',
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Trạng thái Tác vụ:
            </span>
            {status === 'PASSED' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#34d399',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '4px 12px',
                borderRadius: '20px',
              }}>
                <CheckCircle2 size={13} /> ĐẠT (PASSED)
              </span>
            )}
            {status === 'FAILED' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#fb7185',
                backgroundColor: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                padding: '4px 12px',
                borderRadius: '20px',
              }}>
                <XCircle size={13} /> KHÔNG ĐẠT (FAILED)
              </span>
            )}
            {status === 'WAITING' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#60a5fa',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                padding: '4px 12px',
                borderRadius: '20px',
              }}>
                <RefreshCw size={13} className="animate-spin" /> ĐANG KIỂM TRA (WAITING)
              </span>
            )}
            {status === 'PENDING' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#cbd5e1',
                backgroundColor: 'rgba(51, 65, 85, 0.8)',
                border: '1px solid rgba(71, 85, 105, 0.6)',
                padding: '4px 12px',
                borderRadius: '20px',
              }}>
                <Clock size={13} /> CHƯA THỰC HIỆN
              </span>
            )}
          </div>

          {checkTime && (
            <div style={{
              fontSize: '0.75rem',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(15, 23, 42, 0.8)',
              padding: '4px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}>
              <Clock size={13} color="#64748b" />
              <span>Cập nhật mới nhất: <strong style={{ color: '#e2e8f0' }}>{checkTime}</strong></span>
            </div>
          )}
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
            onClick={() => setActiveTab('status')}
            style={{
              padding: '12px 20px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              borderBottom: activeTab === 'status' ? `2px solid ${themeColor}` : '2px solid transparent',
              color: activeTab === 'status' ? themeColor : '#94a3b8',
              backgroundColor: activeTab === 'status' ? themeBg : 'transparent',
              marginBottom: '-1px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
              transition: 'all 0.2s',
            }}
          >
            <Database size={16} />
            {isOps07 ? 'Bảng Trạng thái Gửi Email' : 'Bảng Trạng thái EOD & MM'}
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            style={{
              padding: '12px 20px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              borderBottom: activeTab === 'logs' ? `2px solid ${themeColor}` : '2px solid transparent',
              color: activeTab === 'logs' ? themeColor : '#94a3b8',
              backgroundColor: activeTab === 'logs' ? themeBg : 'transparent',
              marginBottom: '-1px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
              transition: 'all 0.2s',
            }}
          >
            <Terminal size={16} />
            Raw Log / JSON Kết quả
          </button>
        </div>

        {/* Content Body */}
        <div style={{
          padding: '24px 28px',
          flex: 1,
          overflowY: 'auto',
          backgroundColor: 'rgba(15, 23, 42, 0.2)',
          minHeight: '280px',
        }}>
          {activeTab === 'status' ? (
            <div>
              {/* If Email Data exists (ops_open_07) */}
              {isOps07 && emailData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
                        Kết quả quét hòm thư QLGD
                      </h4>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: emailData.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                        color: emailData.success ? '#34d399' : '#fb7185',
                        border: emailData.success ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(244, 63, 94, 0.3)',
                      }}>
                        {emailData.success ? 'THÀNH CÔNG' : 'CÓ LỖI'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                      {emailData.message}
                    </p>
                  </div>
                </div>
              ) : !isOps07 && (ccpData || ceData) ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  {/* CCP Card */}
                  <div style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      padding: '14px 20px',
                      backgroundColor: 'rgba(15, 23, 42, 0.8)',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.85rem' }}>CỔNG CCP</span>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor: ccpData?.eod?.success && ccpData?.mm?.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                        color: ccpData?.eod?.success && ccpData?.mm?.success ? '#34d399' : '#fb7185',
                      }}>
                        {ccpData?.eod?.success && ccpData?.mm?.success ? 'HOÀN HẢO' : 'CÓ LỖI'}
                      </span>
                    </div>

                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{
                        backgroundColor: 'rgba(2, 6, 23, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '10px',
                        padding: '12px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <div>
                          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>Trạng thái EOD</p>
                          <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '2px 0 0 0' }}>Bản ghi: {ccpData?.eod?.totalRecords ?? 0}</p>
                        </div>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: '6px',
                          backgroundColor: ccpData?.eod?.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                          color: ccpData?.eod?.success ? '#34d399' : '#fb7185',
                        }}>
                          {ccpData?.eod?.success ? 'HOÀN TẤT' : 'CHƯA CHỐT'}
                        </span>
                      </div>

                      <div style={{
                        backgroundColor: 'rgba(2, 6, 23, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '10px',
                        padding: '12px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>Lệnh Market Maker (MM)</p>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: ccpData?.mm?.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                            color: ccpData?.mm?.success ? '#34d399' : '#fb7185',
                          }}>
                            {ccpData?.mm?.success ? 'ĐẠT' : 'LỖI'}
                          </span>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', textAlign: 'center' }}>
                          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                            <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0 }}>Active</p>
                            <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f1f5f9', margin: '4px 0 0 0' }}>{ccpData?.mm?.activeOrdersCount ?? 0}</p>
                          </div>
                          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                            <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0 }}>Khớp</p>
                            <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f1f5f9', margin: '4px 0 0 0' }}>{ccpData?.mm?.filledOrdersCount ?? 0}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CE Card */}
                  <div style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      padding: '14px 20px',
                      backgroundColor: 'rgba(15, 23, 42, 0.8)',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.85rem' }}>CỔNG BÙ TRỪ (CE)</span>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor: ceData?.eod?.success && ceData?.mm?.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                        color: ceData?.eod?.success && ceData?.mm?.success ? '#34d399' : '#fb7185',
                      }}>
                        {ceData?.eod?.success && ceData?.mm?.success ? 'HOÀN HẢO' : 'CÓ LỖI'}
                      </span>
                    </div>

                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{
                        backgroundColor: 'rgba(2, 6, 23, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '10px',
                        padding: '12px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <div>
                          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>Trạng thái EOD</p>
                          <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '2px 0 0 0' }}>Bản ghi: {ceData?.eod?.totalRecords ?? 0}</p>
                        </div>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: '6px',
                          backgroundColor: ceData?.eod?.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                          color: ceData?.eod?.success ? '#34d399' : '#fb7185',
                        }}>
                          {ceData?.eod?.success ? 'HOÀN TẤT' : 'CHƯA CHỐT'}
                        </span>
                      </div>

                      <div style={{
                        backgroundColor: 'rgba(2, 6, 23, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '10px',
                        padding: '12px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>Lệnh Market Maker (MM)</p>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: ceData?.mm?.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                            color: ceData?.mm?.success ? '#34d399' : '#fb7185',
                          }}>
                            {ceData?.mm?.success ? 'ĐẠT' : 'LỖI'}
                          </span>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', textAlign: 'center' }}>
                          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                            <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0 }}>Active</p>
                            <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f1f5f9', margin: '4px 0 0 0' }}>{ceData?.mm?.activeOrdersCount ?? 0}</p>
                          </div>
                          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                            <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0 }}>Khớp</p>
                            <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f1f5f9', margin: '4px 0 0 0' }}>{ceData?.mm?.filledOrdersCount ?? 0}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Empty State Box */
                <div style={{
                  padding: '44px 24px',
                  border: '1.5px dashed rgba(255, 255, 255, 0.12)',
                  borderRadius: '16px',
                  backgroundColor: 'rgba(15, 23, 42, 0.4)',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                    color: '#94a3b8',
                  }}>
                    <AlertCircle size={32} />
                  </div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px 0' }}>
                    {isOps07 ? 'Chưa có thông tin phân tích kết quả gửi email' : 'Chưa có thông tin phân tích kết quả OMS'}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', maxWidth: '460px', margin: '0 0 24px 0', lineHeight: 1.5 }}>
                    {isOps07 
                      ? 'Nhấn nút kích hoạt bên dưới để khởi chạy robot Playwright tự động quét hòm thư sao kê.'
                      : 'Nhấn nút kích hoạt bên dưới để robot Playwright tự động quét trạng thái EOD & MM trên cổng OMS.'}
                  </p>
                  <button
                    onClick={handleTriggerCheck}
                    disabled={loading || status === 'WAITING'}
                    style={{
                      padding: '10px 24px',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: '#ffffff',
                      background: isOps07 
                        ? 'linear-gradient(135deg, #3b82f6, #2563eb)' 
                        : 'linear-gradient(135deg, #ec4899, #db2777)',
                      border: 'none',
                      cursor: loading || status === 'WAITING' ? 'not-allowed' : 'pointer',
                      opacity: loading || status === 'WAITING' ? 0.6 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: isOps07 ? '0 4px 12px rgba(59, 130, 246, 0.3)' : '0 4px 12px rgba(236, 72, 153, 0.3)',
                    }}
                  >
                    <Play size={14} fill="currentColor" />
                    Kích hoạt Robot Quét Ngay
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', right: '12px', top: '12px', zIndex: 10 }}>
                <button
                  onClick={handleCopyLogs}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: '#1e293b',
                    color: '#f1f5f9',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  <Copy size={13} />
                  {copied ? 'Đã chép!' : 'Chép JSON'}
                </button>
              </div>
              <pre style={{
                backgroundColor: '#020617',
                color: '#34d399',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #1e293b',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                overflowX: 'auto',
                lineHeight: 1.6,
                margin: 0,
                maxHeight: '440px',
              }}>
                {resultNote ? (isJson ? JSON.stringify(parsedNote, null, 2) : resultNote) : '// Chưa có dữ liệu JSON.'}
              </pre>
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
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={14} color="#64748b" />
            <span>
              {status === 'WAITING' 
                ? 'Robot đang quét dữ liệu trong nền...' 
                : isOps07
                ? 'Hệ thống tự động xác minh lúc 07h00 hàng ngày.'
                : 'Hệ thống tự động quét EOD lúc 05h00 hàng ngày.'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleTriggerCheck}
              disabled={loading || status === 'WAITING'}
              style={{
                padding: '9px 20px',
                borderRadius: '10px',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#ffffff',
                background: isOps07 
                  ? 'linear-gradient(135deg, #3b82f6, #2563eb)' 
                  : 'linear-gradient(135deg, #ec4899, #db2777)',
                border: 'none',
                cursor: loading || status === 'WAITING' ? 'not-allowed' : 'pointer',
                opacity: loading || status === 'WAITING' ? 0.6 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: isOps07 ? '0 4px 12px rgba(59, 130, 246, 0.3)' : '0 4px 12px rgba(236, 72, 153, 0.3)',
              }}
            >
              {loading || status === 'WAITING' ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  {status === 'WAITING' ? 'Đang quét (RPA)...' : 'Đang kích hoạt...'}
                </>
              ) : (
                <>
                  <Play size={14} fill="currentColor" />
                  Chạy lại kiểm tra (RPA)
                </>
              )}
            </button>
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
