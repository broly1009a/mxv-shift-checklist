import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical, ClipboardList, Check, X, ShieldAlert, Plus } from 'lucide-react';
import { API_BASE_URL } from '@/context/AuthContext';

interface UserSnapshot {
  _id: string;
  fullName: string;
  username: string;
  role: string;
}

interface MarginChangeRequest {
  _id: string;
  commodity: string;
  oldMargin: number;
  newMargin: number;
  effectiveSession: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  createdBy: UserSnapshot;
  approvedBy?: UserSnapshot | null;
  rejectionReason?: string | null;
  comments?: string | null;
  createdAt: string;
}

interface MarginChangeRequestsWidgetProps {
  token: string | null;
  currentUser: any;
}

export const MarginChangeRequestsWidget: React.FC<MarginChangeRequestsWidgetProps> = ({ token, currentUser }) => {
  const [requests, setRequests] = useState<MarginChangeRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<MarginChangeRequest | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Form states
  const [commodity, setCommodity] = useState<string>('');
  const [oldMargin, setOldMargin] = useState<string>('');
  const [newMargin, setNewMargin] = useState<string>('');
  const [effectiveSession, setEffectiveSession] = useState<string>('');
  const [comments, setComments] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Rejection state
  const [rejectionReason, setRejectionReason] = useState<string>('');

  const fetchRequests = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/margin-change-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách yêu cầu thay đổi ký quỹ:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // Backup interval
    const timer = setInterval(fetchRequests, 20000);
    return () => clearInterval(timer);
  }, [token]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commodity.trim() || !oldMargin.trim() || !newMargin.trim() || !effectiveSession.trim()) {
      setFormError('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }
    setFormError('');
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/margin-change-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          commodity,
          oldMargin: Number(oldMargin),
          newMargin: Number(newMargin),
          effectiveSession,
          comments
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Lỗi gửi yêu cầu');
      }

      setShowCreateModal(false);
      setCommodity('');
      setOldMargin('');
      setNewMargin('');
      setEffectiveSession('');
      setComments('');
      fetchRequests();
    } catch (err: any) {
      setFormError(err.message || 'Không thể tạo yêu cầu thay đổi ký quỹ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!token) return;
    if (!confirm('Bạn có chắc chắn muốn phê duyệt yêu cầu thay đổi ký quỹ này không?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/margin-change-requests/${id}/approve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.message || 'Phê duyệt thất bại');
      } else {
        fetchRequests();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectSubmit = async () => {
    if (!token || !showRejectModal) return;
    if (!rejectionReason.trim()) {
      alert('Vui lòng nhập lý do từ chối.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/margin-change-requests/${showRejectModal._id}/reject`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          reason: rejectionReason
        })
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.message || 'Từ chối thất bại');
      } else {
        setShowRejectModal(null);
        setRejectionReason('');
        fetchRequests();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (status: MarginChangeRequest['status']) => {
    switch (status) {
      case 'PENDING_APPROVAL':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '4px'
            }}
          >
            Chờ duyệt
          </span>
        );
      case 'APPROVED':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '4px'
            }}
          >
            Đã duyệt
          </span>
        );
      case 'REJECTED':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '4px'
            }}
          >
            Từ chối
          </span>
        );
    }
  };

  // Helper checking checker privileges
  const canApprove = (req: MarginChangeRequest) => {
    if (!currentUser) return false;
    const isMaker = (req.createdBy._id || (req.createdBy as any).id || '').toString() === (currentUser.id || currentUser._id || '').toString();
    const isCheckerRole = ['ADMIN', 'CHAIRMAN', 'CEO', 'DIVISION_DIRECTOR', 'DEPARTMENT_HEAD'].includes(currentUser.role || '');
    return !isMaker && isCheckerRole;
  };

  const isMakerUser = (req: MarginChangeRequest) => {
    if (!currentUser) return false;
    return (req.createdBy._id || (req.createdBy as any).id || '').toString() === (currentUser.id || currentUser._id || '').toString();
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', position: 'relative', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ position: 'absolute', top: '24px', right: '24px', color: 'var(--text-muted)', cursor: 'grab' }} title="Kéo thả để sắp xếp">
        <GripVertical size={16} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: '24px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <ClipboardList size={18} color="var(--color-primary)" /> Phê duyệt Ký Quỹ (Maker-Checker)
        </h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
          style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', height: '32px' }}
        >
          <Plus size={14} /> Tạo yêu cầu
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0', fontSize: '0.82rem' }}>
          Đang tải danh sách yêu cầu...
        </div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 0', border: '1px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Chưa có yêu cầu thay đổi ký quỹ nào.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto' }} className="custom-scrollbar">
          {requests.map((req) => {
            const isPending = req.status === 'PENDING_APPROVAL';
            const reqIsMaker = isMakerUser(req);
            const reqCanApprove = canApprove(req);

            return (
              <div
                key={req._id}
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {req.commodity}
                    </span>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Maker: <strong style={{ color: 'var(--text-secondary)' }}>{req.createdBy?.fullName || req.createdBy?.username || 'Hệ thống'}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    {getStatusBadge(req.status)}
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {new Date(req.createdAt).toLocaleDateString('vi-VN')} {new Date(req.createdAt).toLocaleTimeString('vi-VN')}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '8px 10px', background: 'rgba(255, 255, 255, 0.015)', borderRadius: '6px', fontSize: '0.75rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>Ký quỹ cũ</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>${req.oldMargin.toLocaleString()}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>Ký quỹ mới</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>${req.newMargin.toLocaleString()}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>Phiên áp dụng</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{req.effectiveSession}</span>
                  </div>
                </div>

                {req.comments && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.01)', padding: '6px 8px', borderRadius: '4px' }}>
                    <strong>Ghi chú:</strong> {req.comments}
                  </div>
                )}

                {req.status === 'REJECTED' && req.rejectionReason && (
                  <div style={{ fontSize: '0.72rem', color: '#ef4444', background: 'rgba(239,68,68,0.04)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.1)' }}>
                    <strong>Lý do từ chối:</strong> {req.rejectionReason}
                  </div>
                )}

                {req.status === 'APPROVED' && req.approvedBy && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', alignSelf: 'flex-end' }}>
                    Checker duyệt: <strong style={{ color: 'var(--text-secondary)' }}>{req.approvedBy.fullName}</strong>
                  </div>
                )}

                {isPending && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px', alignItems: 'center' }}>
                    {reqIsMaker && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ShieldAlert size={12} color="#f59e0b" /> Bạn là Maker (chờ phê duyệt)
                      </span>
                    )}

                    <button
                      disabled={!reqCanApprove}
                      onClick={() => handleApprove(req._id)}
                      className="btn"
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.72rem',
                        height: '28px',
                        backgroundColor: reqCanApprove ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                        color: reqCanApprove ? '#10b981' : 'var(--text-muted)',
                        border: `1px solid ${reqCanApprove ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-color)'}`,
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: reqCanApprove ? 'pointer' : 'not-allowed',
                        opacity: reqCanApprove ? 1 : 0.6
                      }}
                      title={reqIsMaker ? 'Bạn không thể tự duyệt yêu cầu của mình' : 'Chỉ Approver được phép duyệt'}
                    >
                      <Check size={12} /> Duyệt
                    </button>

                    <button
                      disabled={!reqCanApprove}
                      onClick={() => setShowRejectModal(req)}
                      className="btn"
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.72rem',
                        height: '28px',
                        backgroundColor: reqCanApprove ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                        color: reqCanApprove ? '#ef4444' : 'var(--text-muted)',
                        border: `1px solid ${reqCanApprove ? 'rgba(239, 68, 68, 0.2)' : 'var(--border-color)'}`,
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: reqCanApprove ? 'pointer' : 'not-allowed',
                        opacity: reqCanApprove ? 1 : 0.6
                      }}
                      title={reqIsMaker ? 'Bạn không thể tự bác bỏ yêu cầu của mình' : 'Chỉ Approver được phép bác bỏ'}
                    >
                      <X size={12} /> Từ chối
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Creation Modal */}
      {showCreateModal && mounted && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '460px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ClipboardList size={18} color="var(--color-primary)" /> Tạo yêu cầu thay đổi ký quỹ
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormError('');
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateRequest} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Mặt hàng (Commodity)*</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: Dầu thô WTI, Đồng LME, Ngô..."
                  value={commodity}
                  onChange={(e) => setCommodity(e.target.value)}
                  style={{ background: '#1e293b', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Ký quỹ cũ (USD)*</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Ví dụ: 7000"
                    value={oldMargin}
                    onChange={(e) => setOldMargin(e.target.value)}
                    style={{ background: '#1e293b', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Ký quỹ mới (USD)*</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Ví dụ: 6500"
                    value={newMargin}
                    onChange={(e) => setNewMargin(e.target.value)}
                    style={{ background: '#1e293b', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Phiên áp dụng (Effective Session)*</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: Phiên Mỹ 24/06/2026, Đầu phiên..."
                  value={effectiveSession}
                  onChange={(e) => setEffectiveSession(e.target.value)}
                  style={{ background: '#1e293b', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Mô tả/Ghi chú thêm</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Lý do điều chỉnh, quyết định của sở..."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  style={{ background: '#1e293b', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', resize: 'vertical' }}
                />
              </div>

              {formError && (
                <div style={{ fontSize: '0.75rem', color: '#ef4444', background: 'rgba(239,68,68,0.04)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.1)' }}>
                  {formError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormError('');
                  }}
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  style={{ padding: '8px 16px', fontSize: '0.8rem' }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  style={{ padding: '8px 16px', fontSize: '0.8rem' }}
                >
                  {isSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Reject Reason Dialog */}
      {showRejectModal && mounted && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={18} color="#ef4444" /> Từ chối yêu cầu [{showRejectModal.commodity}]
              </h3>
              <button
                onClick={() => {
                  setShowRejectModal(null);
                  setRejectionReason('');
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Lý do từ chối*</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Nhập lý do chi tiết từ chối phê duyệt..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  style={{ background: '#1e293b', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectModal(null);
                    setRejectionReason('');
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.8rem' }}
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleRejectSubmit}
                  className="btn btn-primary"
                  style={{ padding: '8px 16px', fontSize: '0.8rem', backgroundColor: '#ef4444', borderColor: '#ef4444' }}
                >
                  Xác nhận từ chối
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
