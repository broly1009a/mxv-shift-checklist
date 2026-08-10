'use client';

import React, { useState, useEffect, useRef } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import { 
  Upload, 
  FileText, 
  Trash2, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  FolderOpen,
  X
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface FileItem {
  file: File;
  category: string;
  categoryType: 'CQG' | 'MS' | 'ACM';
}

export default function UploadBackupPage() {
  const { user: currentUser, token } = useAuth();
  const router = useRouter();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [date, setDate] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);
  const [activeTab, setActiveTab] = useState<'AUTO' | 'CQG' | 'MS' | 'ACM'>('AUTO');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string; files?: any[] } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set default date to today (GMT+7)
  useEffect(() => {
    const today = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const yyyy = today.getUTCFullYear().toString();
    const mm = (today.getUTCMonth() + 1).toString().padStart(2, '0');
    const dd = today.getUTCDate().toString().padStart(2, '0');
    setDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  // Determine file category based on filename
  const getFileCategory = (name: string): { name: string; type: 'CQG' | 'MS' | 'ACM' } => {
    const lowerName = name.toLowerCase();
    if (
      lowerName.includes('fr') ||
      lowerName.includes('od') ||
      lowerName.includes('op') ||
      lowerName.includes('ps') ||
      lowerName.includes('as')
    ) {
      return { name: 'CQG Backup (Thô / Gộp)', type: 'CQG' };
    } else if (lowerName.includes('straits')) {
      return { name: 'Straits ACM (Thư mục ACM)', type: 'ACM' };
    } else if (
      lowerName.includes('dsgd') ||
      lowerName.includes('tttt') ||
      lowerName.includes('ttm')
    ) {
      return { name: 'M-System Backup (Thư mục Futures)', type: 'MS' };
    }
    return { name: 'M-System (Mặc định)', type: 'MS' };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (files: File[]) => {
    const newItems = files.map(file => {
      let catInfo;
      if (activeTab === 'AUTO') {
        catInfo = getFileCategory(file.name);
      } else {
        if (activeTab === 'CQG') {
          catInfo = { name: 'CQG Backup (Thô / Gộp)', type: 'CQG' as const };
        } else if (activeTab === 'ACM') {
          catInfo = { name: 'Straits ACM (Thư mục ACM)', type: 'ACM' as const };
        } else {
          catInfo = { name: 'M-System Backup (Thư mục Futures)', type: 'MS' as const };
        }
      }
      return {
        file,
        category: catInfo.name,
        categoryType: catInfo.type
      };
    });

    // Filter out duplicates based on filename
    setSelectedFiles(prev => {
      const filtered = prev.filter(item => !files.some(f => f.name === item.file.name));
      return [...filtered, ...newItems];
    });
    setUploadResult(null);
  };

  const updateFileCategory = (index: number, newType: 'CQG' | 'MS' | 'ACM') => {
    setSelectedFiles(prev => {
      const updated = [...prev];
      let catName = '';
      if (newType === 'CQG') {
        catName = 'CQG Backup (Thô / Gộp)';
      } else if (newType === 'ACM') {
        catName = 'Straits ACM (Thư mục ACM)';
      } else {
        catName = 'M-System Backup (Thư mục Futures)';
      }
      updated[index] = {
        ...updated[index],
        categoryType: newType,
        category: catName
      };
      return updated;
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setUploadResult(null);
  };

  const clearAll = () => {
    setSelectedFiles([]);
    setUploadResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 file để upload');
      return;
    }
    if (!date) {
      toast.error('Vui lòng chọn ngày đối chiếu');
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    selectedFiles.forEach(item => {
      formData.append('files', item.file);
      formData.append('categories', item.categoryType);
    });
    formData.append('date', date);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/reconciliation/upload-backup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Upload tệp đối chiếu thành công!');
        setUploadResult({
          success: true,
          message: data.message,
          files: data.savedFiles
        });
        setSelectedFiles([]); // Clear list on success
      } else {
        toast.error(data.message || 'Lỗi khi tải tệp lên');
        setUploadResult({
          success: false,
          message: data.message || 'Không thể tải tệp lên máy chủ'
        });
      }
    } catch (err: any) {
      toast.error('Lỗi kết nối máy chủ');
      setUploadResult({
        success: false,
        message: 'Lỗi kết nối mạng, vui lòng thử lại.'
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div 
        className="flex-1 flex flex-col animate-fade-in" 
        style={{ gap: '24px', color: 'var(--text-primary)' }}
      >
          {/* Page Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FolderOpen color="#10b981" size={26} />
                Tải Lên Tệp Đối Chiếu Thủ Công
              </h1>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Công cụ dự phòng tải file CQG/M-System để chạy kiểm tra đối chiếu khi chưa có kết nối tự động.
              </p>
            </div>
            
            {/* Date Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Ngày đối chiếu:</span>
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="form-input"
                style={{ 
                  fontSize: '0.8rem', 
                  padding: '8px 12px', 
                  width: '160px', 
                  backgroundColor: 'var(--bg-input)', 
                  color: 'var(--text-primary)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '6px',
                  colorScheme: 'dark'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'start' }} className="grid grid-cols-1 lg:grid-cols-3">
            {/* Upload Area */}
            <div className="lg:col-span-2 flex flex-col gap-6" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Category Selector Tabs */}
              <div 
                style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  borderBottom: '1px solid var(--border-color)', 
                  paddingBottom: '4px', 
                  overflowX: 'auto', 
                  WebkitOverflowScrolling: 'touch', 
                  whiteSpace: 'nowrap' 
                }} 
                className="table-responsive-wrapper"
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('AUTO')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderRadius: '8px 8px 0 0',
                    border: 'none',
                    borderBottom: activeTab === 'AUTO' ? '2px solid #10b981' : '2px solid transparent',
                    color: activeTab === 'AUTO' ? '#10b981' : 'var(--text-secondary)',
                    backgroundColor: activeTab === 'AUTO' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  Tự động nhận dạng
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('CQG')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderRadius: '8px 8px 0 0',
                    border: 'none',
                    borderBottom: activeTab === 'CQG' ? '2px solid #10b981' : '2px solid transparent',
                    color: activeTab === 'CQG' ? '#10b981' : 'var(--text-secondary)',
                    backgroundColor: activeTab === 'CQG' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  CQG Backup
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('MS')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderRadius: '8px 8px 0 0',
                    border: 'none',
                    borderBottom: activeTab === 'MS' ? '2px solid #10b981' : '2px solid transparent',
                    color: activeTab === 'MS' ? '#10b981' : 'var(--text-secondary)',
                    backgroundColor: activeTab === 'MS' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  M-System Futures
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('ACM')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderRadius: '8px 8px 0 0',
                    border: 'none',
                    borderBottom: activeTab === 'ACM' ? '2px solid #10b981' : '2px solid transparent',
                    color: activeTab === 'ACM' ? '#10b981' : 'var(--text-secondary)',
                    backgroundColor: activeTab === 'ACM' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  Straits ACM
                </button>
              </div>

              {/* Dropzone Container Card */}
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  📤 Kéo thả tệp tin hoặc click để chọn
                </h5>
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: isDragging ? '2px dashed #10b981' : '2px dashed var(--border-color)',
                    borderRadius: '12px',
                    padding: '40px 20px',
                    backgroundColor: isDragging ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-input)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                  }}
                  onMouseOver={(e) => {
                    if (!isDragging) {
                      e.currentTarget.style.borderColor = 'var(--text-secondary)';
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isDragging) {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.backgroundColor = 'var(--bg-input)';
                    }
                  }}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    multiple
                    className="hidden"
                  />
                  
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: activeTab === 'CQG' 
                      ? '#a855f7' 
                      : activeTab === 'ACM' 
                      ? '#10b981'
                      : activeTab === 'MS'
                      ? '#6366f1'
                      : '#3b82f6'
                  }}>
                    <Upload size={24} />
                  </div>
                  
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      {activeTab === 'AUTO' && 'Kéo & thả các tệp tin vào đây'}
                      {activeTab === 'CQG' && 'Kéo & thả các tệp tin CQG vào đây'}
                      {activeTab === 'MS' && 'Kéo & thả các tệp tin M-System Futures vào đây'}
                      {activeTab === 'ACM' && 'Kéo & thả các tệp tin Straits ACM vào đây'}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                      Hoặc click để mở trình duyệt chọn file
                    </p>
                  </div>

                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    {activeTab === 'AUTO' && (
                      <span>Hệ thống tự động nhận dạng: CQG (FR, OD, OP, PS) / MS (DSGD, TTTT, TTM, Straits)</span>
                    )}
                    {activeTab === 'CQG' && <span>(Sẽ lưu vào thư mục: Backup CQG\Futures)</span>}
                    {activeTab === 'MS' && <span>(Sẽ lưu vào thư mục: Backup MS\Futures)</span>}
                    {activeTab === 'ACM' && <span>(Sẽ lưu vào thư mục: Backup MS\ACM)</span>}
                  </div>
                </div>
              </div>

              {/* Selected Files List */}
              {selectedFiles.length > 0 && (
                <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <h5 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      📋 Danh sách tệp tin đã chọn ({selectedFiles.length})
                    </h5>
                    <button 
                      onClick={clearAll}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.7rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444' }}
                    >
                      <Trash2 size={12} />
                      Xóa tất cả
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                    {selectedFiles.map((item, index) => (
                      <div 
                        key={index} 
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 16px',
                          backgroundColor: 'var(--bg-input)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          gap: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                          <FileText 
                            size={16} 
                            color={
                              item.categoryType === 'CQG' 
                                ? '#a855f7' 
                                : item.categoryType === 'ACM' 
                                ? '#10b981'
                                : '#6366f1'
                            } 
                            style={{ flexShrink: 0 }}
                          />
                          <div style={{ overflow: 'hidden' }}>
                            <p style={{ fontSize: '0.775rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.file.name}>
                              {item.file.name}
                            </p>
                            <span style={{ fontSize: '0.675rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                              {(item.file.size / 1024).toFixed(1)} KB • {item.category}
                            </span>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <select
                            value={item.categoryType}
                            onChange={(e) => updateFileCategory(index, e.target.value as any)}
                            className="form-input"
                            style={{
                              fontSize: '0.7rem',
                              padding: '4px 8px',
                              width: '120px',
                              backgroundColor: 'var(--bg-sidebar, #1e293b)',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-primary)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                            }}
                          >
                            <option value="CQG">CQG Backup</option>
                            <option value="MS">MS Futures</option>
                            <option value="ACM">Straits ACM</option>
                          </select>
                          <button 
                            onClick={() => removeFile(index)}
                            className="btn btn-secondary"
                            style={{ padding: '6px', borderRadius: '50%', color: 'var(--text-muted)' }}
                            title="Gỡ bỏ"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <button
                      onClick={handleUpload}
                      disabled={isUploading}
                      className="btn btn-primary"
                      style={{ fontSize: '0.8rem', padding: '10px 20px', fontWeight: 700, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="animate-spin" size={16} />
                          Đang tải lên và phân loại...
                        </>
                      ) : (
                        <>
                          <Upload size={16} />
                          Tải lên {selectedFiles.length} tệp tin đối chiếu
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Results / Guidelines */}
            <div className="flex flex-col gap-6" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Upload Result Notification */}
              {uploadResult && (
                <div className="glass-panel" style={{
                  padding: '20px',
                  border: uploadResult.success ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                  backgroundColor: uploadResult.success ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                  color: uploadResult.success ? '#34d399' : '#f87171',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {uploadResult.success ? (
                      <CheckCircle2 color="#10b981" size={20} />
                    ) : (
                      <AlertCircle color="#ef4444" size={20} />
                    )}
                    <h5 style={{ fontSize: '0.8rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      {uploadResult.success ? 'Tải lên thành công!' : 'Tải lên thất bại'}
                    </h5>
                  </div>
                  
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    {uploadResult.message}
                  </p>

                  {uploadResult.files && uploadResult.files.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Đường dẫn tệp tin:</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                        {uploadResult.files.map((f, i) => (
                          <div key={i} style={{ fontSize: '0.7rem', backgroundColor: 'var(--bg-input)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{f.filename}</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', wordBreak: 'break-all', marginTop: '2px' }} title={f.path}>{f.path}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Guideline Card */}
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h5 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', margin: 0 }}>
                  💡 Hướng dẫn định tuyến File
                </h5>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  Hệ thống tự động phát hiện tên file để đẩy vào đúng thư mục cấu hình:
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#a855f7', marginTop: '6px', flexShrink: 0 }}></span>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>Thư mục Backup CQG</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.4, display: 'block', marginTop: '2px' }}>
                        Các tệp chứa: <strong>FR, OD, OP, PS, AS</strong> (Ví dụ: `FR1.xlsx`, `Od.xlsx`...)
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6366f1', marginTop: '6px', flexShrink: 0 }}></span>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>Thư mục Backup M-System</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.4, display: 'block', marginTop: '2px' }}>
                        Các tệp chứa: <strong>DSGD, TTTT, TTM</strong> — Lưu vào <strong>Backup MS\Futures</strong>
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', marginTop: '6px', flexShrink: 0 }}></span>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>Thư mục Backup Straits ACM</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.4, display: 'block', marginTop: '2px' }}>
                        Các tệp chứa: <strong>Straits</strong> — Lưu vào <strong>Backup MS\ACM</strong>
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#eab308', marginTop: '6px', flexShrink: 0 }}></span>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>Quy tắc định dạng ngày</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.4, display: 'block', marginTop: '2px' }}>
                        Tự động lưu vào cấu trúc thư mục:<br />
                        <code style={{ color: '#10b981', backgroundColor: 'var(--bg-input)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontFamily: 'monospace', border: '1px solid var(--border-color)', display: 'inline-block', marginTop: '4px' }}>đường_dẫn_backup/YYYY/TMM.YYYY/DD.MM</code>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
}
