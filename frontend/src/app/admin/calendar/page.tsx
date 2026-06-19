'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import { 
  Calendar, 
  Plus, 
  Trash2, 
  Save, 
  Edit,
  X,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Info,
  List
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const CalendarView = dynamic(() => import('@/components/CalendarView'), {
  ssr: false,
  loading: () => <div style={{ color: 'var(--text-secondary)', padding: '40px', textAlign: 'center' }}>Đang tải lịch biểu...</div>
});

interface CalendarEntry {
  date: string;
  isTradingDay: boolean;
  isHoliday: boolean;
  isWeekend: boolean;
  note?: string;
}

export default function AdminCalendarPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'ADMIN';

  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CalendarEntry | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  // Form fields
  const [formDate, setFormDate] = useState('');
  const [formIsTrading, setFormIsTrading] = useState(true);
  const [formIsHoliday, setFormIsHoliday] = useState(false);
  const [formNote, setFormNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Redirect if not allowed
  useEffect(() => {
    if (user) {
      const allowedRoles = ['ADMIN', 'CHAIRMAN', 'CEO', 'DIVISION_DIRECTOR', 'DEPARTMENT_HEAD'];
      if (!allowedRoles.includes(user.role)) {
        router.push('/dashboard');
      }
    }
  }, [user, router]);

  const fetchCalendarEntries = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/working-calendar`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCalendarEntries();
  }, [fetchCalendarEntries]);

  const openCreateModal = () => {
    setEditingEntry(null);
    // Default to tomorrow's date
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    const dateStr = tom.toISOString().split('T')[0];

    setFormDate(dateStr);
    setFormIsTrading(true);
    setFormIsHoliday(false);
    setFormNote('');
    setError('');
    setSuccess('');
    setModalOpen(true);
  };

  const openCreateModalWithDate = (date: string) => {
    setEditingEntry(null);
    setFormDate(date);
    setFormIsTrading(true);
    setFormIsHoliday(false);
    setFormNote('');
    setError('');
    setSuccess('');
    setModalOpen(true);
  };

  const openEditModal = (entry: CalendarEntry) => {
    setEditingEntry(entry);
    setFormDate(entry.date);
    setFormIsTrading(entry.isTradingDay);
    setFormIsHoliday(entry.isHoliday);
    setFormNote(entry.note || '');
    setError('');
    setSuccess('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const url = editingEntry 
        ? `${API_BASE_URL}/api/v1/working-calendar/${editingEntry.date}` 
        : `${API_BASE_URL}/api/v1/working-calendar`;
      
      const method = editingEntry ? 'PUT' : 'POST';
      const bodyData = {
        date: formDate,
        isTradingDay: formIsTrading,
        isHoliday: formIsHoliday,
        note: formNote
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(bodyData)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Lưu cấu hình lịch thất bại');
      }

      setSuccess(editingEntry ? 'Cập nhật ngày thành công!' : 'Thêm ngày cấu hình mới thành công!');
      setModalOpen(false);
      fetchCalendarEntries();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (entry: CalendarEntry) => {
    if (!token || !window.confirm(`Bạn có chắc chắn muốn xóa cấu hình ngày ${entry.date}?`)) return;
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/working-calendar/${entry.date}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Xóa cấu hình ngày thất bại');
      }

      setSuccess('Đã xóa cấu hình lịch thành công!');
      fetchCalendarEntries();
    } catch (err: any) {
      setError(err.message || 'Lỗi xảy ra');
    }
  };

  const formatDateLabel = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' };
    return dateObj.toLocaleDateString('vi-VN', options);
  };

  return (
    <ProtectedRoute>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: '4px' }}>
              Quản Trị Lịch Giao Dịch
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Cấu hình các ngày nghỉ lễ, ngày cuối tuần và các trường hợp đặc biệt không chạy sinh ca tự động.
            </p>
          </div>
          {isAdmin && (
            <button onClick={openCreateModal} className="btn btn-primary" style={{ padding: '12px 20px' }}>
              <Plus size={18} /> Thêm ngày đặc biệt
            </button>
          )}
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '8px', color: '#ef4444', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px 16px', borderRadius: '8px', color: 'var(--color-primary)', fontSize: '0.875rem' }}>
            {success}
          </div>
        )}

        {/* Info Card */}
        <div className="glass-panel" style={{ padding: '20px', background: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.2)', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          <Info size={24} color="#3b82f6" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '4px' }}>Cơ chế chạy sinh ca tự động</h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Hệ thống sẽ chạy cron job vào lúc <strong>00:01 hàng ngày</strong> để tự động khởi tạo ca trực cho các bộ phận. 
              Nếu ngày hiện tại không phải ngày giao dịch (như ngày cuối tuần, nghỉ lễ được cấu hình ở đây), hệ thống sẽ tự động bỏ qua.
            </p>
          </div>
        </div>

        {/* Toggle View Mode */}
        <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <button
            onClick={() => setViewMode('calendar')}
            className={`btn ${viewMode === 'calendar' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '0.85rem' }}
          >
            <Calendar size={16} /> Lịch biểu trực quan
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '0.85rem' }}
          >
            <List size={16} /> Danh sách cấu hình ({entries.length} ngày)
          </button>
        </div>

        {viewMode === 'calendar' ? (
          <div>
            <CalendarView 
              entries={entries} 
              onSelectDate={(date, entry) => {
                if (isAdmin) {
                  if (entry) {
                    openEditModal(entry);
                  } else {
                    openCreateModalWithDate(date);
                  }
                }
              }} 
            />
          </div>
        ) : (
          /* Content list */
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <Calendar size={18} color="var(--color-accent)" /> Danh sách ngày có cấu hình tùy chỉnh ({entries.length} ngày)
            </h3>

            {loading ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '20px 0', textAlign: 'center' }}>
                Đang tải lịch cấu hình...
              </div>
            ) : entries.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '40px 0', textAlign: 'center' }}>
                Chưa có ngày cấu hình đặc biệt nào. Mặc định các ngày thứ 7 và Chủ nhật sẽ được tính là ngày nghỉ, các ngày trong tuần là ngày giao dịch.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {entries.map(entry => (
                  <div key={entry.date} style={{
                    padding: '20px',
                    borderRadius: '12px',
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    position: 'relative'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {entry.date}
                        </h4>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {formatDateLabel(entry.date)}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {entry.isTradingDay ? (
                          <span className="badge badge-low" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>Ngày giao dịch</span>
                        ) : (
                          <span className="badge badge-critical" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>Nghỉ / Cuối tuần</span>
                        )}
                      </div>
                    </div>

                    {entry.note && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', borderLeft: '3px solid var(--border-color)' }}>
                        {entry.note}
                      </p>
                    )}

                    {isAdmin && (
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
                        <button 
                          onClick={() => openEditModal(entry)} 
                          className="btn btn-secondary" 
                          style={{ padding: '8px 14px', fontSize: '0.78rem', gap: '4px' }}
                        >
                          <Edit size={12} /> Sửa
                        </button>
                        <button 
                          onClick={() => handleDelete(entry)} 
                          className="btn btn-secondary" 
                          style={{ padding: '8px 14px', fontSize: '0.78rem', color: '#ef4444', gap: '4px' }}
                        >
                          <Trash2 size={12} /> Xóa
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '480px',
            padding: '24px',
            position: 'relative'
          }}>
            <button
              onClick={() => setModalOpen(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={20} color="var(--color-primary)" />
              {editingEntry ? 'Chỉnh sửa ngày' : 'Cấu hình ngày mới'}
            </h3>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Ngày cấu hình <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="date"
                  className="form-input"
                  required
                  disabled={!!editingEntry || submitting}
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  style={{ background: 'var(--bg-app)', cursor: editingEntry ? 'not-allowed' : 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Ngày giao dịch (Trading Day)
                  </label>
                  <input
                    type="checkbox"
                    checked={formIsTrading}
                    onChange={(e) => {
                      setFormIsTrading(e.target.checked);
                      if (e.target.checked) setFormIsHoliday(false);
                    }}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    disabled={submitting}
                  />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Nếu chọn, ca trực tự động sẽ được tạo bình thường vào ngày này.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Ngày nghỉ lễ (Holiday)
                  </label>
                  <input
                    type="checkbox"
                    checked={formIsHoliday}
                    onChange={(e) => {
                      setFormIsHoliday(e.target.checked);
                      if (e.target.checked) setFormIsTrading(false);
                    }}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    disabled={submitting}
                  />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Đánh dấu đây là ngày nghỉ lễ chính thức. Hệ thống sẽ không sinh ca trực.
                </p>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Ghi chú / Lý do
                </label>
                <textarea
                  className="form-input"
                  placeholder="vd: Nghỉ Tết Dương Lịch 2026..."
                  rows={3}
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  style={{ background: 'var(--bg-app)', resize: 'vertical' }}
                  disabled={submitting}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
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
                  {submitting ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
