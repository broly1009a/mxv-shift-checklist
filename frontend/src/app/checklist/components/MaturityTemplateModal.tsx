'use client';

import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Copy, Check, Search, RefreshCw, Layers } from 'lucide-react';
import { API_BASE_URL } from '@/context/AuthContext';
import toast from 'react-hot-toast';

interface TemplateItem {
  id: string;
  category: string;
  commodityCode: string;
  commodityName: string;
  contractMonth: string;
  title: string;
  content: string;
  targetRole: string;
}

interface MaturityTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  shiftLogId: string;
  taskId: string;
  shiftDate?: string;
}

export default function MaturityTemplateModal({
  isOpen,
  onClose,
  token,
  shiftLogId,
  taskId,
  shiftDate,
}: MaturityTemplateModalProps) {
  const [activeTab, setActiveTab] = useState<'cards' | 'json'>('cards');
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAllJson, setCopiedAllJson] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/reconciliation/maturity-manual-messages?shiftLogId=${shiftLogId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Không thể tải dữ liệu templates đáo hạn');
      }

      const responseData = await res.json();
      if (responseData.success && Array.isArray(responseData.jsonContent)) {
        const mappedTemplates: TemplateItem[] = responseData.jsonContent.map((item: any, idx: number) => ({
          id: `${item.account}_${item.contractCode}_${idx}`,
          category: `Thành viên ${item.memberCode}`,
          commodityCode: item.contractCode,
          commodityName: item.contractName,
          contractMonth: '',
          title: `Tài khoản: ${item.account}`,
          content: item.messageText,
          targetRole: 'QLGD',
        }));
        setTemplates(mappedTemplates);
      } else {
        setTemplates([]);
      }
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Đã sao chép tin nhắn!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAllJson = () => {
    const jsonStr = JSON.stringify(templates, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopiedAllJson(true);
    toast.success('Đã sao chép toàn bộ JSON templates!');
    setTimeout(() => setCopiedAllJson(false), 2000);
  };

  // Filter templates
  const filteredTemplates = templates.filter(t => {
    const matchesSearch = 
      t.commodityCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.commodityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.content.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'ALL' || t.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(templates.map(t => t.category).filter(Boolean)));

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
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              color: '#818cf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <MessageSquare size={22} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#f8fafc',
                margin: 0,
                lineHeight: 1.4,
              }}>
                Templates Tin nhắn Đáo hạn Hợp đồng
              </h2>
              <p style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                margin: '3px 0 0 0',
                lineHeight: 1.3,
              }}>
                Sao chép các tin nhắn thông báo thủ công gửi thành viên QLGD (ngày {shiftDate || 'hiện tại'})
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={fetchTemplates}
              disabled={loading}
              title="Tải lại dữ liệu"
              style={{
                padding: '8px',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '8px',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '8px',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '8px',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab Selectors */}
        <div style={{
          display: 'flex',
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '0 28px',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setActiveTab('cards')}
            style={{
              padding: '12px 20px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              borderBottom: activeTab === 'cards' ? '2px solid #818cf8' : '2px solid transparent',
              color: activeTab === 'cards' ? '#818cf8' : '#94a3b8',
              backgroundColor: activeTab === 'cards' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
              marginBottom: '-1px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
            }}
          >
            <MessageSquare size={16} />
            Thẻ Tin nhắn mẫu
          </button>
          <button
            onClick={() => setActiveTab('json')}
            style={{
              padding: '12px 20px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              borderBottom: activeTab === 'json' ? '2px solid #818cf8' : '2px solid transparent',
              color: activeTab === 'json' ? '#818cf8' : '#94a3b8',
              backgroundColor: activeTab === 'json' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
              marginBottom: '-1px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
            }}
          >
            <Layers size={16} />
            Dữ liệu JSON Tổng hợp
          </button>
        </div>

        {/* Main Body */}
        <div style={{
          padding: '24px 28px',
          flex: 1,
          overflowY: 'auto',
          backgroundColor: 'rgba(15, 23, 42, 0.2)',
        }}>
          {activeTab === 'cards' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Search & Filter Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  position: 'relative',
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', color: '#64748b' }} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Tìm theo mã hàng hóa, tên SP hoặc nội dung tin..."
                    style={{
                      width: '100%',
                      backgroundColor: '#020617',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '8px 12px 8px 36px',
                      color: '#f8fafc',
                      fontSize: '0.8rem',
                      outline: 'none',
                    }}
                  />
                </div>

                {categories.length > 0 && (
                  <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    style={{
                      backgroundColor: '#020617',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: '#f8fafc',
                      fontSize: '0.8rem',
                      outline: 'none',
                    }}
                  >
                    <option value="ALL">Tất cả Phân loại</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Cards List */}
              {filteredTemplates.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '16px' }}>
                  {filteredTemplates.map(item => (
                    <div
                      key={item.id}
                      style={{
                        backgroundColor: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '12px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              backgroundColor: 'rgba(99, 102, 241, 0.15)',
                              color: '#818cf8',
                              border: '1px solid rgba(99, 102, 241, 0.3)',
                              padding: '2px 8px',
                              borderRadius: '6px',
                            }}>
                              {item.commodityCode} {item.contractMonth}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                              {item.commodityName}
                            </span>
                          </div>

                          <button
                            onClick={() => handleCopyText(item.id, item.content)}
                            style={{
                              padding: '5px 12px',
                              backgroundColor: copiedId === item.id ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                              color: copiedId === item.id ? '#34d399' : '#e2e8f0',
                              border: copiedId === item.id ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '6px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              flexShrink: 0,
                            }}
                          >
                            {copiedId === item.id ? <Check size={13} /> : <Copy size={13} />}
                            {copiedId === item.id ? 'Đã sao chép' : 'Sao chép'}
                          </button>
                        </div>

                        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px 0' }}>
                          {item.title}
                        </h4>

                        <p style={{
                          fontSize: '0.8rem',
                          color: '#cbd5e1',
                          backgroundColor: '#020617',
                          border: '1px solid #1e293b',
                          borderRadius: '8px',
                          padding: '12px',
                          margin: 0,
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}>
                          {item.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  padding: '40px',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: '0.85rem',
                }}>
                  Không tìm thấy template tin nhắn phù hợp.
                </div>
              )}

            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', right: '12px', top: '12px', zIndex: 10 }}>
                <button
                  onClick={handleCopyAllJson}
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
                  {copiedAllJson ? 'Đã chép tất cả!' : 'Sao chép JSON'}
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
                {JSON.stringify(templates, null, 2)}
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
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Tổng cộng: <strong style={{ color: '#f8fafc' }}>{templates.length}</strong> template tin nhắn.
          </div>

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
  );
}
