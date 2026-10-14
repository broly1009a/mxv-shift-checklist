'use client';

import React from 'react';
import {
  Folder,
  Loader2,
  Check,
  Mail,
  Globe,
  Maximize2,
  FileText,
  Eye,
  Download,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from 'lucide-react';
import { CleanRecord, AccountManifest, PreviewImageState, PreviewPdfState } from '../../types/tkgd.types';
import { formatDateStr } from '../../utils/tkgd.helpers';

interface TabAttachmentsViewerProps {
  inspectRecord: CleanRecord;
  accountManifest: AccountManifest | null;
  loadingManifest: boolean;
  onPreviewImage: (state: PreviewImageState) => void;
  onPreviewPdf: (state: PreviewPdfState) => void;
  apiBaseUrl: string;
}

export const TabAttachmentsViewer: React.FC<TabAttachmentsViewerProps> = ({
  inspectRecord,
  accountManifest,
  loadingManifest,
  onPreviewImage,
  onPreviewPdf,
  apiBaseUrl,
}) => {
  const [showFrontWarningDetail, setShowFrontWarningDetail] = React.useState(false);
  const [showBackWarningDetail, setShowBackWarningDetail] = React.useState(false);

  const frontWarnings = React.useMemo(() => {
    return (accountManifest?.ocrSummary?.canhBaoChatLuong || []).filter(
      (w) => !w.toLowerCase().includes('sau') && !w.toLowerCase().includes('back')
    );
  }, [accountManifest?.ocrSummary?.canhBaoChatLuong]);

  const backWarnings = React.useMemo(() => {
    return (accountManifest?.ocrSummary?.canhBaoChatLuong || []).filter(
      (w) => w.toLowerCase().includes('sau') || w.toLowerCase().includes('back')
    );
  }, [accountManifest?.ocrSummary?.canhBaoChatLuong]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Đường dẫn thư mục lưu trữ thực tế */}
      <div
        style={{
          padding: '10px 14px',
          borderRadius: '10px',
          backgroundColor: 'var(--bg-input)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          fontSize: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Folder size={14} color="#3b82f6" />
          <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Thư mục lưu trữ:</span>
          <code style={{ color: '#3b82f6', fontSize: '0.72rem' }}>
            {accountManifest?.directory || inspectRecord.ms?.cccdMatTruocLocalPath || 'HoSo_DinhKem'}
          </code>
        </div>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: '6px',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            color: '#3b82f6',
            fontWeight: 600,
            fontSize: '0.7rem',
          }}
        >
          {accountManifest?.totalFiles !== undefined ? `${accountManifest.totalFiles} tệp hồ sơ` : 'Đang quét tệp...'}
        </span>
      </div>

      {loadingManifest ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Loader2 className="animate-spin" size={28} style={{ margin: '0 auto 10px auto', color: '#3b82f6' }} />
          <p style={{ margin: 0, fontSize: '0.85rem' }}>Đang nạp hồ sơ đính kèm và kết nối stream ảnh...</p>
        </div>
      ) : (
        <>
          {/* KHỐI 1: SO SÁNH CCCD MẶT TRƯỚC */}
          <div
            style={{
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              overflow: 'hidden',
            }}
          >
            {/* Header Khối 1 */}
            <div
              style={{
                padding: '12px 18px',
                backgroundColor: 'var(--bg-input)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    color: '#3b82f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                  }}
                >
                  1
                </span>
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700 }}>
                  Ảnh CCCD Mặt Trước (Đối chiếu 2 nguồn)
                </h4>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem' }}>
                {accountManifest?.ocrSummary?.soCanCuocMail ? (
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                      color: '#10b981',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Check size={12} strokeWidth={3} />
                    Số CCCD: {accountManifest.ocrSummary.soCanCuocMail}
                  </span>
                ) : null}
                {(() => {
                  const theGen = accountManifest?.ocrSummary?.theGeneration || inspectRecord?.canCuoc?.theGeneration;
                  const confScore = accountManifest?.ocrSummary?.confidenceScore !== undefined
                    ? accountManifest.ocrSummary.confidenceScore
                    : inspectRecord?.canCuoc?.confidenceScore;
                  return (
                    <>
                      {theGen && (
                        <span
                          style={{
                            padding: '3px 10px',
                            borderRadius: '12px',
                            backgroundColor: theGen === 'CAN_CUOC_2024' ? 'rgba(168, 85, 247, 0.12)' : theGen === 'CMND_9_SO' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                            color: theGen === 'CAN_CUOC_2024' ? '#a855f7' : theGen === 'CMND_9_SO' ? '#ef4444' : '#3b82f6',
                            fontWeight: 600,
                          }}
                        >
                          {theGen === 'CAN_CUOC_2024' && ' Căn Cước 2024'}
                          {theGen === 'CCCD_CHIP_2021' && ' CCCD Gắn Chip'}
                          {theGen === 'CCCD_MA_VACH' && ' CCCD Mã Vạch'}
                          {theGen === 'CMND_9_SO' && ' CMND 9 Số Cũ'}
                        </span>
                      )}
                      {confScore !== undefined && (
                        <span
                          style={{
                            padding: '3px 10px',
                            borderRadius: '12px',
                            backgroundColor: confScore >= 0.95 ? 'rgba(16, 185, 129, 0.12)' : confScore >= 0.80 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            color: confScore >= 0.95 ? '#10b981' : confScore >= 0.80 ? '#f59e0b' : '#ef4444',
                            fontWeight: 700,
                          }}
                        >
                          Tin cậy: {Math.round(confScore * 100)}%
                        </span>
                      )}
                      {inspectRecord?.canCuoc?.source === 'VERIFIED_MS_HASH' && (
                        <span
                          style={{
                            padding: '3px 10px',
                            borderRadius: '12px',
                            backgroundColor: 'rgba(6, 182, 212, 0.12)',
                            color: '#0891b2',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title="Ảnh đính kèm Mail và ảnh trên M-System trùng khớp 100% mã băm MD5. Số CCCD được bảo chứng chéo qua Hợp đồng và MS."
                        >
                          <ShieldCheck size={12} strokeWidth={2.5} /> Bảo Chứng Ảnh MS (MD5)
                        </span>
                      )}
                    </>
                  );
                })()}
                {frontWarnings.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowFrontWarningDetail((prev) => !prev)}
                    style={{
                      padding: '3px 10px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.72rem',
                      transition: 'all 0.15s ease',
                    }}
                    title="Bấm để xem/ẩn chi tiết cảnh báo chất lượng ảnh"
                  >
                    <AlertTriangle size={12} />
                    <span>{frontWarnings.length === 1 ? 'Mép ảnh sát viền' : `${frontWarnings.length} cảnh báo viền`}</span>
                    {showFrontWarningDetail ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                ) : (
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      color: '#3b82f6',
                      fontWeight: 600,
                    }}
                  >
                    ✓ Đủ 4 góc viền
                  </span>
                )}
              </div>
            </div>

            {/* Chi tiết cảnh báo mặt trước (chỉ mở khi người dùng bấm nút) */}
            {showFrontWarningDetail && frontWarnings.length > 0 && (
              <div
                style={{
                  padding: '10px 18px',
                  backgroundColor: 'rgba(239, 68, 68, 0.05)',
                  borderBottom: '1px solid rgba(239, 68, 68, 0.15)',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <AlertTriangle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: '3px' }}>
                    Chi tiết cảnh báo chất lượng ảnh mặt trước:
                  </div>
                  {frontWarnings.map((w, idx) => (
                    <div key={idx} style={{ color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      • {w}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Body: Split View 2 Cột */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', padding: '16px' }}>
              {/* Cột Trái: Mail */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  backgroundColor: 'var(--bg-input)',
                  borderRadius: '10px',
                  padding: '12px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Mail size={13} />  Tệp Đính Kèm Mail (Khách gửi)
                  </span>
                  {accountManifest?.files?.mailCccdFront && (
                    <button
                      onClick={() =>
                        onPreviewImage({
                          url: `${apiBaseUrl}${accountManifest.files.mailCccdFront?.url}`,
                          title: 'CCCD Mặt Trước (Mail đính kèm)',
                          source: 'MAIL',
                          rotation: 0,
                        })
                      }
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#3b82f6',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                      }}
                    >
                      <Maximize2 size={12} /> Phóng to
                    </button>
                  )}
                </div>

                {accountManifest?.files?.mailCccdFront ? (
                  <div
                    onClick={() =>
                      onPreviewImage({
                        url: `${apiBaseUrl}${accountManifest.files.mailCccdFront?.url}`,
                        title: 'CCCD Mặt Trước (Mail đính kèm)',
                        source: 'MAIL',
                        rotation: 0,
                      })
                    }
                    style={{
                      height: '180px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      backgroundColor: '#0f172a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'zoom-in',
                      position: 'relative',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <img
                      src={`${apiBaseUrl}${accountManifest.files.mailCccdFront.url}`}
                      alt="CCCD Mặt Trước (Mail)"
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '6px',
                        right: '6px',
                        backgroundColor: 'rgba(0,0,0,0.65)',
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.65rem',
                      }}
                    >
                      {accountManifest.files.mailCccdFront.fileName}
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      height: '180px',
                      borderRadius: '8px',
                      border: '1px dashed var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                      textAlign: 'center',
                      padding: '12px',
                    }}
                  >
                    Chưa có ảnh CCCD mặt trước từ email
                  </div>
                )}
              </div>

              {/* Cột Phải: M-System */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  backgroundColor: 'var(--bg-input)',
                  borderRadius: '10px',
                  padding: '12px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Globe size={13} />  Tải Từ M-System (TVKD up)
                  </span>
                  {accountManifest?.files?.msCccdFront && (
                    <button
                      onClick={() =>
                        onPreviewImage({
                          url: `${apiBaseUrl}${accountManifest.files.msCccdFront?.url}`,
                          title: 'CCCD Mặt Trước (M-System)',
                          source: 'MS',
                          rotation: 0,
                        })
                      }
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#10b981',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                      }}
                    >
                      <Maximize2 size={12} /> Phóng to
                    </button>
                  )}
                </div>

                {accountManifest?.files?.msCccdFront ? (
                  <div
                    onClick={() =>
                      onPreviewImage({
                        url: `${apiBaseUrl}${accountManifest.files.msCccdFront?.url}`,
                        title: 'CCCD Mặt Trước (M-System)',
                        source: 'MS',
                        rotation: 0,
                      })
                    }
                    style={{
                      height: '180px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      backgroundColor: '#0f172a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'zoom-in',
                      position: 'relative',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <img
                      src={`${apiBaseUrl}${accountManifest.files.msCccdFront.url}`}
                      alt="CCCD Mặt Trước (MS)"
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '6px',
                        right: '6px',
                        backgroundColor: 'rgba(0,0,0,0.65)',
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.65rem',
                      }}
                    >
                      {accountManifest.files.msCccdFront.fileName}
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      height: '180px',
                      borderRadius: '8px',
                      border: '1px dashed var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                      textAlign: 'center',
                      padding: '12px',
                    }}
                  >
                    Chưa cào được ảnh CCCD mặt trước từ M-System
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* KHỐI 2: SO SÁNH CCCD MẶT SAU */}
          <div
            style={{
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              overflow: 'hidden',
            }}
          >
            {/* Header Khối 2 */}
            <div
              style={{
                padding: '12px 18px',
                backgroundColor: 'var(--bg-input)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    color: '#3b82f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                  }}
                >
                  2
                </span>
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700 }}>
                  Ảnh CCCD Mặt Sau (Đối chiếu 2 nguồn)
                </h4>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem' }}>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    color: '#10b981',
                    fontWeight: 600,
                  }}
                >
                  ✓ Nhận diện MRZ & Ngày cấp
                </span>
                {backWarnings.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowBackWarningDetail((prev) => !prev)}
                    style={{
                      padding: '3px 10px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.72rem',
                      transition: 'all 0.15s ease',
                    }}
                    title="Bấm để xem/ẩn chi tiết cảnh báo chất lượng ảnh"
                  >
                    <AlertTriangle size={12} />
                    <span>{backWarnings.length === 1 ? 'Mép ảnh sát viền' : `${backWarnings.length} cảnh báo viền`}</span>
                    {showBackWarningDetail ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                ) : (
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      color: '#3b82f6',
                      fontWeight: 600,
                    }}
                  >
                    ✓ Đủ 4 góc viền
                  </span>
                )}
              </div>
            </div>

            {/* Chi tiết cảnh báo mặt sau (chỉ mở khi người dùng bấm nút) */}
            {showBackWarningDetail && backWarnings.length > 0 && (
              <div
                style={{
                  padding: '10px 18px',
                  backgroundColor: 'rgba(239, 68, 68, 0.05)',
                  borderBottom: '1px solid rgba(239, 68, 68, 0.15)',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <AlertTriangle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: '3px' }}>
                    Chi tiết cảnh báo chất lượng ảnh mặt sau:
                  </div>
                  {backWarnings.map((w, idx) => (
                    <div key={idx} style={{ color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      • {w}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Body: Split View 2 Cột */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', padding: '16px' }}>
              {/* Cột Trái: Mail */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  backgroundColor: 'var(--bg-input)',
                  borderRadius: '10px',
                  padding: '12px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Mail size={13} />  Tệp Đính Kèm Mail (Khách gửi)
                  </span>
                  {accountManifest?.files?.mailCccdBack && (
                    <button
                      onClick={() =>
                        onPreviewImage({
                          url: `${apiBaseUrl}${accountManifest.files.mailCccdBack?.url}`,
                          title: 'CCCD Mặt Sau (Mail đính kèm)',
                          source: 'MAIL',
                          rotation: 0,
                        })
                      }
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#3b82f6',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                      }}
                    >
                      <Maximize2 size={12} /> Phóng to
                    </button>
                  )}
                </div>

                {accountManifest?.files?.mailCccdBack ? (
                  <div
                    onClick={() =>
                      onPreviewImage({
                        url: `${apiBaseUrl}${accountManifest.files.mailCccdBack?.url}`,
                        title: 'CCCD Mặt Sau (Mail đính kèm)',
                        source: 'MAIL',
                        rotation: 0,
                      })
                    }
                    style={{
                      height: '180px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      backgroundColor: '#0f172a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'zoom-in',
                      position: 'relative',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <img
                      src={`${apiBaseUrl}${accountManifest.files.mailCccdBack.url}`}
                      alt="CCCD Mặt Sau (Mail)"
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '6px',
                        right: '6px',
                        backgroundColor: 'rgba(0,0,0,0.65)',
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.65rem',
                      }}
                    >
                      {accountManifest.files.mailCccdBack.fileName}
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      height: '180px',
                      borderRadius: '8px',
                      border: '1px dashed var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                      textAlign: 'center',
                      padding: '12px',
                    }}
                  >
                    Chưa có ảnh CCCD mặt sau từ email
                  </div>
                )}
              </div>

              {/* Cột Phải: M-System */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  backgroundColor: 'var(--bg-input)',
                  borderRadius: '10px',
                  padding: '12px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Globe size={13} />  Tải Từ M-System (TVKD up)
                  </span>
                  {accountManifest?.files?.msCccdBack && (
                    <button
                      onClick={() =>
                        onPreviewImage({
                          url: `${apiBaseUrl}${accountManifest.files.msCccdBack?.url}`,
                          title: 'CCCD Mặt Sau (M-System)',
                          source: 'MS',
                          rotation: 0,
                        })
                      }
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#10b981',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                      }}
                    >
                      <Maximize2 size={12} /> Phóng to
                    </button>
                  )}
                </div>

                {accountManifest?.files?.msCccdBack ? (
                  <div
                    onClick={() =>
                      onPreviewImage({
                        url: `${apiBaseUrl}${accountManifest.files.msCccdBack?.url}`,
                        title: 'CCCD Mặt Sau (M-System)',
                        source: 'MS',
                        rotation: 0,
                      })
                    }
                    style={{
                      height: '180px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      backgroundColor: '#0f172a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'zoom-in',
                      position: 'relative',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <img
                      src={`${apiBaseUrl}${accountManifest.files.msCccdBack.url}`}
                      alt="CCCD Mặt Sau (MS)"
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '6px',
                        right: '6px',
                        backgroundColor: 'rgba(0,0,0,0.65)',
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.65rem',
                      }}
                    >
                      {accountManifest.files.msCccdBack.fileName}
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      height: '180px',
                      borderRadius: '8px',
                      border: '1px dashed var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                      textAlign: 'center',
                      padding: '12px',
                    }}
                  >
                    Chưa cào được ảnh CCCD mặt sau từ M-System
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* KHỐI 3: CHỮ KÝ MẪU & HỒ SƠ PHÁP LÝ (PDF) */}
          <div
            style={{
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              overflow: 'hidden',
            }}
          >
            {/* Header Khối 3 */}
            <div
              style={{
                padding: '12px 18px',
                backgroundColor: 'var(--bg-input)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                  }}
                >
                  3
                </span>
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700 }}>
                  Chữ Ký Mẫu & Hồ Sơ Pháp Lý (PDF Hợp Đồng / Phụ Lục)
                </h4>
              </div>

              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  color: '#10b981',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                }}
              >
                Chữ ký: {inspectRecord.hopDong?.chuKy || inspectRecord.ms?.chuKy || 'Đã ký'}
              </span>
            </div>

            {/* Body Khối 3 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', padding: '16px' }}>
              {/* Cột Trái: Chữ Ký Mẫu M-System */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  backgroundColor: 'var(--bg-input)',
                  borderRadius: '10px',
                  padding: '12px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    Chữ Ký Mẫu (M-System)
                  </span>
                  {accountManifest?.files?.msSignature && (
                    <button
                      onClick={() =>
                        onPreviewImage({
                          url: `${apiBaseUrl}${accountManifest.files.msSignature?.url}`,
                          title: 'Chữ Ký Mẫu (M-System)',
                          source: 'MS',
                          rotation: 0,
                        })
                      }
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#10b981',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                      }}
                    >
                      <Maximize2 size={12} /> Phóng to
                    </button>
                  )}
                </div>

                {accountManifest?.files?.msSignature ? (
                  <div
                    onClick={() =>
                      onPreviewImage({
                        url: `${apiBaseUrl}${accountManifest.files.msSignature?.url}`,
                        title: 'Chữ Ký Mẫu (M-System)',
                        source: 'MS',
                        rotation: 0,
                      })
                    }
                    style={{
                      height: '140px',
                      borderRadius: '8px',
                      backgroundColor: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'zoom-in',
                      position: 'relative',
                      border: '1px solid var(--border-color)',
                      padding: '10px',
                    }}
                  >
                    <img
                      src={`${apiBaseUrl}${accountManifest.files.msSignature.url}`}
                      alt="Chữ Ký M-System"
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '6px',
                        right: '6px',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.65rem',
                      }}
                    >
                      {accountManifest.files.msSignature.fileName}
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      height: '140px',
                      borderRadius: '8px',
                      border: '1px dashed var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                    }}
                  >
                    Chưa có chữ ký mẫu từ M-System
                  </div>
                )}
              </div>

              {/* Cột Phải: Hợp Đồng PDF & Phụ Lục PL01 */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  backgroundColor: 'var(--bg-input)',
                  borderRadius: '10px',
                  padding: '12px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <FileText size={13} color="#ef4444" /> Hồ Sơ Pháp Lý (Văn Bản Ký)
                </span>

                {/* Thẻ Hợp đồng */}
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                      Hợp Đồng Mở TKGD
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Số: {inspectRecord.hopDong?.soHopDong || 'HĐ-MXV'} | Ký: {formatDateStr(inspectRecord.hopDong?.ngayKyHD) || 'Theo đợt'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {accountManifest?.files?.mailContractPdf ? (
                      <>
                        <button
                          onClick={() =>
                            onPreviewPdf({
                              url: `${apiBaseUrl}${accountManifest.files.mailContractPdf?.url}`,
                              title: `Hợp Đồng Mở TKGD (${inspectRecord.maTKGDBase || inspectRecord.maTKGD})`,
                            })
                          }
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(59, 130, 246, 0.12)',
                            color: '#3b82f6',
                            border: '1px solid rgba(59, 130, 246, 0.25)',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Eye size={12} /> Xem trực tiếp
                        </button>
                        <a
                          href={`${apiBaseUrl}${accountManifest.files.mailContractPdf.url}`}
                          download
                          title="Tải file PDF"
                          style={{
                            padding: '5px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--bg-input)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            textDecoration: 'none',
                          }}
                        >
                          <Download size={12} />
                        </a>
                      </>
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Chưa có PDF</span>
                    )}
                  </div>
                </div>

                {/* Thẻ Phụ lục PL01 (ACM) */}
                {(accountManifest?.files?.mailPl01Pdf || inspectRecord.accountTypes?.includes('ACM') || inspectRecord.noiDungMail?.hasACMRequest) && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                        Phụ Lục PL01 (Tiểu khoản ACM)
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Tiểu khoản: {inspectRecord.maTKGDBase ? `${inspectRecord.maTKGDBase}-A` : '-'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {accountManifest?.files?.mailPl01Pdf ? (
                        <>
                          <button
                            onClick={() =>
                              onPreviewPdf({
                                url: `${apiBaseUrl}${accountManifest.files.mailPl01Pdf?.url}`,
                                title: `Phụ Lục PL01 ACM (${inspectRecord.maTKGDBase || inspectRecord.maTKGD}-A)`,
                              })
                            }
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(16, 185, 129, 0.12)',
                              color: '#10b981',
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Eye size={12} /> Xem PL01
                          </button>
                          <a
                            href={`${apiBaseUrl}${accountManifest.files.mailPl01Pdf.url}`}
                            download
                            title="Tải file PL01"
                            style={{
                              padding: '5px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'var(--bg-input)',
                              color: 'var(--text-secondary)',
                              border: '1px solid var(--border-color)',
                              display: 'flex',
                              alignItems: 'center',
                              textDecoration: 'none',
                            }}
                          >
                            <Download size={12} />
                          </a>
                        </>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Chưa có PL01</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
