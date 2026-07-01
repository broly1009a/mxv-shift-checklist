'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import { Clock, Plus, Edit, Trash2, X, Save, AlertCircle, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface ShiftSlot {
  _id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  isOvernight: boolean;
  isActive: boolean;
  sortOrder: number;
  gracePeriodMinutes?: number;
}

function validateForm(
  name: string,
  code: string,
  startTime: string,
  endTime: string,
  shiftSlots: ShiftSlot[],
  editingId?: string
) {
  const errors: { name?: string; code?: string; startTime?: string; endTime?: string } = {};

  if (!name.trim()) {
    errors.name = 'Tên ca trực không được để trống';
  }

  if (!code.trim()) {
    errors.code = 'Mã ca trực không được để trống';
  } else if (!/^[A-Z0-9_]+$/.test(code.trim())) {
    errors.code = 'Mã ca trực chỉ chứa chữ in hoa, số và dấu gạch dưới';
  } else {
    const duplicate = shiftSlots.find(
      (s) => s.code.toUpperCase() === code.trim().toUpperCase() && s._id !== editingId
    );
    if (duplicate) {
      errors.code = `Mã ca trực "${code.trim()}" đã tồn tại`;
    }
  }

  if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(startTime.trim())) {
    errors.startTime = 'Định dạng giờ bắt đầu không hợp lệ (HH:mm)';
  }

  if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(endTime.trim())) {
    errors.endTime = 'Định dạng giờ kết thúc không hợp lệ (HH:mm)';
  }

  return errors;
}

export default function AdminShiftSlotsPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'ADMIN';

  const [shiftSlots, setShiftSlots] = useState<ShiftSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ShiftSlot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isOvernight, setIsOvernight] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState(0);

  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    code?: string;
    startTime?: string;
    endTime?: string;
  }>({});

  // Redirect if not admin or manager
  useEffect(() => {
    if (user) {
      const allowedRoles = ['ADMIN', 'CHAIRMAN', 'CEO', 'DIVISION_DIRECTOR', 'DEPARTMENT_HEAD'];
      if (!allowedRoles.includes(user.role)) router.push('/dashboard');
    }
  }, [user, router]);

  const fetchShiftSlots = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/shift-slots`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      // Sort slots by sortOrder then startTime
      const sorted = (Array.isArray(data) ? data : []).sort((a: ShiftSlot, b: ShiftSlot) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.startTime.localeCompare(b.startTime);
      });
      setShiftSlots(sorted);
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi tải danh sách ca trực');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchShiftSlots();
  }, [fetchShiftSlots]);

  const openAddModal = () => {
    setEditingSlot(null);
    setName('');
    setCode('');
    setStartTime('08:00');
    setEndTime('17:00');
    setIsOvernight(false);
    setIsActive(true);
    setSortOrder(shiftSlots.length + 1);
    setGracePeriodMinutes(15);
    setFieldErrors({});
    setModalOpen(true);
  };

  const openEditModal = (slot: ShiftSlot) => {
    setEditingSlot(slot);
    setName(slot.name);
    setCode(slot.code);
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
    setIsOvernight(slot.isOvernight);
    setIsActive(slot.isActive);
    setSortOrder(slot.sortOrder);
    setGracePeriodMinutes(slot.gracePeriodMinutes || 0);
    setFieldErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingSlot(null);
    setFieldErrors({});
  };

  const handleCodeChange = (val: string) => {
    setCode(val.toUpperCase().replace(/[^A-Z0-9_]/g, ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = validateForm(name, code, startTime, endTime, shiftSlots, editingSlot?._id);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);

    try {
      const method = editingSlot ? 'PUT' : 'POST';
      const url = editingSlot
        ? `${API_BASE_URL}/api/v1/shift-slots/${editingSlot._id}`
        : `${API_BASE_URL}/api/v1/shift-slots`;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim(),
          startTime: startTime.trim(),
          endTime: endTime.trim(),
          isOvernight,
          isActive,
          sortOrder: Number(sortOrder),
          gracePeriodMinutes: Number(gracePeriodMinutes),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Thao tác lưu ca trực thất bại');
      }

      toast.success(editingSlot ? 'Cập nhật ca trực thành công!' : 'Tạo ca trực mới thành công!');
      fetchShiftSlots();
      closeModal();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (slot: ShiftSlot) => {
    if (!window.confirm(`Bạn có chắc chắn muốn XÓA ca trực "${slot.name}" (${slot.code})?`)) return;

    setDeletingId(slot._id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/shift-slots/${slot._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Xóa ca trực thất bại');
      }
      const data = await res.json();
      if (data.statusChanged) {
        toast.success(`Ca trực "${slot.name}" đã phát sinh lịch sử hoạt động nên đã được chuyển sang trạng thái Vô hiệu hóa (Tắt) thay vì xóa vật lý.`);
      } else {
        toast.success(`Đã xóa ca trực "${slot.name}"`);
      }
      fetchShiftSlots();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi xóa ca trực');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <ProtectedRoute>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: '4px' }}>
              Cấu Hình Khung Ca Trực & SLA
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Quản lý thời gian biểu các ca trực, cờ qua đêm và thời gian ân hạn SLA.
            </p>
          </div>
          {isAdmin && (
            <button onClick={openAddModal} className="btn btn-primary" style={{ padding: '12px 20px' }}>
              <Plus size={18} /> Thêm ca trực mới
            </button>
          )}
        </div>

        {/* Table */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>Đang tải dữ liệu...</div>
          ) : shiftSlots.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
              Chưa có cấu hình ca trực nào. Nhấn <strong>"Thêm ca trực mới"</strong> để bắt đầu.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '12px 16px' }}>Thứ tự</th>
                    <th style={{ padding: '12px 16px' }}>Tên Ca</th>
                    <th style={{ padding: '12px 16px' }}>Mã Ca (Code)</th>
                    <th style={{ padding: '12px 16px' }}>Khung Giờ</th>
                    <th style={{ padding: '12px 16px' }}>Qua đêm</th>
                    <th style={{ padding: '12px 16px' }}>TG Ân Hạn SLA</th>
                    <th style={{ padding: '12px 16px' }}>Trạng thái</th>
                    {isAdmin && <th style={{ padding: '12px 16px' }}>Hành Động</th>}
                  </tr>
                </thead>
                <tbody>
                  {shiftSlots.map((slot) => (
                    <tr
                      key={slot._id}
                      style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.005)' }}
                    >
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {slot.sortOrder}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <Clock size={16} color="var(--color-accent)" />
                          {slot.name}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <code style={{
                          background: 'rgba(59, 130, 246, 0.1)',
                          border: '1px solid rgba(59, 130, 246, 0.2)',
                          color: 'var(--color-accent)',
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                        }}>
                          {slot.code}
                        </code>
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {slot.startTime} - {slot.endTime}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {slot.isOvernight ? (
                          <span className="badge badge-high" style={{ padding: '2px 8px', borderRadius: '4px' }}>Có</span>
                        ) : (
                          <span className="badge badge-low" style={{ padding: '2px 8px', borderRadius: '4px' }}>Không</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                        {slot.gracePeriodMinutes || 0} phút
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {slot.isActive ? (
                          <span className="badge badge-low" style={{ padding: '2px 8px', borderRadius: '4px' }}>Hoạt động</span>
                        ) : (
                          <span className="badge badge-critical" style={{ padding: '2px 8px', borderRadius: '4px' }}>Khóa</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                              onClick={() => openEditModal(slot)}
                              className="btn btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            >
                              <Edit size={14} /> Sửa
                            </button>
                            <button
                              onClick={() => handleDelete(slot)}
                              disabled={deletingId === slot._id}
                              className="btn btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#ef4444', opacity: deletingId === slot._id ? 0.6 : 1 }}
                            >
                              <Trash2 size={14} /> {deletingId === slot._id ? 'Đang xóa...' : 'Xóa'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && isAdmin && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflowY: 'auto',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '480px',
            background: 'var(--bg-app)', border: '1px solid var(--border-color)',
            borderRadius: '16px', padding: '24px',
            display: 'flex', flexDirection: 'column', gap: '20px',
            margin: 'auto'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={20} color="var(--color-accent)" />
                {editingSlot ? 'Chỉnh sửa ca trực' : 'Thêm ca trực mới'}
              </h2>
              <button onClick={closeModal} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>


            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Tên ca trực <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="VD: Ca sáng vận hành"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  style={{ borderColor: fieldErrors.name ? '#ef4444' : undefined }}
                  disabled={submitting}
                />
                {fieldErrors.name && (
                  <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={12} /> {fieldErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Mã ca trực (Code) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="VD: SHIFT_1"
                  value={code}
                  onChange={(e) => {
                    handleCodeChange(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, code: undefined }));
                  }}
                  style={{
                    borderColor: fieldErrors.code ? '#ef4444' : undefined,
                    fontFamily: 'monospace',
                    letterSpacing: '0.05em',
                  }}
                  disabled={submitting || !!editingSlot}
                />
                {fieldErrors.code && (
                  <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={12} /> {fieldErrors.code}
                  </p>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Giờ Bắt Đầu <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="HH:mm (vd: 06:00)"
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, startTime: undefined }));
                    }}
                    style={{ borderColor: fieldErrors.startTime ? '#ef4444' : undefined }}
                    disabled={submitting}
                  />
                  {fieldErrors.startTime && (
                    <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '5px' }}>{fieldErrors.startTime}</p>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Giờ Kết Thúc <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="HH:mm (vd: 14:00)"
                    value={endTime}
                    onChange={(e) => {
                      setEndTime(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, endTime: undefined }));
                    }}
                    style={{ borderColor: fieldErrors.endTime ? '#ef4444' : undefined }}
                    disabled={submitting}
                  />
                  {fieldErrors.endTime && (
                    <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '5px' }}>{fieldErrors.endTime}</p>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Thứ tự sắp xếp
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    TG Ân Hạn SLA (phút)
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={gracePeriodMinutes}
                    onChange={(e) => setGracePeriodMinutes(Number(e.target.value))}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isOvernight}
                    onChange={(e) => setIsOvernight(e.target.checked)}
                    disabled={submitting}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  Ca qua đêm
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    disabled={submitting}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  Hoạt động
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  disabled={submitting}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={submitting}
                >
                  <Save size={16} />
                  {submitting ? 'Đang lưu...' : (editingSlot ? 'Cập nhật' : 'Tạo mới')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
