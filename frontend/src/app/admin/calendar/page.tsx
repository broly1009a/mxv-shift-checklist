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
  List,
  Clock,
  Settings,
  Check
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';

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

interface ShiftSlot {
  id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  isOvernight: boolean;
  isActive: boolean;
  sortOrder: number;
}

export default function AdminCalendarPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'ADMIN';

  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CalendarEntry | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'standards'>('calendar');

  // Operational Standards states
  const [shiftGenTime, setShiftGenTime] = useState('00:01');
  const [weeklyRestDays, setWeeklyRestDays] = useState<number[]>([0, 6]);
  const [shiftSlots, setShiftSlots] = useState<ShiftSlot[]>([]);
  const [loadingStandards, setLoadingStandards] = useState(false);
  const [savingStandards, setSavingStandards] = useState(false);

  // Slot modal state
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ShiftSlot | null>(null);
  const [slotName, setSlotName] = useState('');
  const [slotCode, setSlotCode] = useState('');
  const [slotStartTime, setSlotStartTime] = useState('08:00');
  const [slotEndTime, setSlotEndTime] = useState('17:00');
  const [slotIsOvernight, setSlotIsOvernight] = useState(false);
  const [slotIsActive, setSlotIsActive] = useState(true);
  const [slotSortOrder, setSlotSortOrder] = useState(0);

  // Form fields
  const [formDate, setFormDate] = useState('');
  const [formIsTrading, setFormIsTrading] = useState(true);
  const [formIsHoliday, setFormIsHoliday] = useState(false);
  const [formIsRecurring, setFormIsRecurring] = useState(false);
  const [formNote, setFormNote] = useState('');
  const [submitting, setSubmitting] = useState(false);



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
    Promise.resolve().then(() => {
      fetchCalendarEntries();
    });
  }, [fetchCalendarEntries]);

  const fetchStandards = useCallback(async () => {
    if (!token) return;
    setLoadingStandards(true);
    try {
      const settingsRes = await fetch(`${API_BASE_URL}/api/v1/system-settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        const genTimeObj = settings.find((s: any) => s.key === 'shift_generation_time');
        const restDaysObj = settings.find((s: any) => s.key === 'weekly_rest_days');
        
        if (genTimeObj) setShiftGenTime(genTimeObj.value);
        if (restDaysObj) {
          try {
            setWeeklyRestDays(JSON.parse(restDaysObj.value));
          } catch {
            setWeeklyRestDays([0, 6]);
          }
        }
      }

      const slotsRes = await fetch(`${API_BASE_URL}/api/v1/shift-slots`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (slotsRes.ok) {
        const slots = await slotsRes.json();
        setShiftSlots(slots.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0)));
      }
    } catch (err) {
      console.error('Error fetching standards:', err);
    } finally {
      setLoadingStandards(false);
    }
  }, [token]);

  useEffect(() => {
    if (viewMode === 'standards') {
      Promise.resolve().then(() => {
        fetchStandards();
      });
    }
  }, [viewMode, fetchStandards]);

  const saveSystemSetting = async (key: string, value: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/system-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ key, value })
      });
      if (!res.ok) {
        throw new Error('Không thể lưu cài đặt hệ thống');
      }
      toast.success('Cập nhật cấu hình hệ thống thành công!');
      fetchStandards();
    } catch (err: any) {
      toast.error(err.message || 'Có lỗi xảy ra');
    } finally {
      setSavingStandards(false);
    }
  };

  const handleToggleRestDay = (day: number) => {
    if (weeklyRestDays.includes(day)) {
      setWeeklyRestDays(weeklyRestDays.filter(d => d !== day));
    } else {
      setWeeklyRestDays([...weeklyRestDays, day].sort());
    }
  };

  const openCreateSlotModal = () => {
    setEditingSlot(null);
    setSlotName('');
    setSlotCode('');
    setSlotStartTime('08:00');
    setSlotEndTime('17:00');
    setSlotIsOvernight(false);
    setSlotIsActive(true);
    setSlotSortOrder(shiftSlots.length);
    setSlotModalOpen(true);
  };

  const openEditSlotModal = (slot: ShiftSlot) => {
    setEditingSlot(slot);
    setSlotName(slot.name);
    setSlotCode(slot.code);
    setSlotStartTime(slot.startTime);
    setSlotEndTime(slot.endTime);
    setSlotIsOvernight(slot.isOvernight);
    setSlotIsActive(slot.isActive);
    setSlotSortOrder(slot.sortOrder);
    setSlotModalOpen(true);
  };

  const handleSlotSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const url = editingSlot
        ? `${API_BASE_URL}/api/v1/shift-slots/${editingSlot.id}`
        : `${API_BASE_URL}/api/v1/shift-slots`;
      const method = editingSlot ? 'PUT' : 'POST';
      const bodyData = {
        name: slotName,
        code: slotCode,
        startTime: slotStartTime,
        endTime: slotEndTime,
        isOvernight: slotIsOvernight,
        isActive: slotIsActive,
        sortOrder: Number(slotSortOrder)
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
        throw new Error(data.message || 'Lưu ca trực thất bại');
      }

      toast.success(editingSlot ? 'Cập nhật ca trực thành công!' : 'Tạo ca trực mới thành công!');
      setSlotModalOpen(false);
      fetchStandards();
    } catch (err: any) {
      toast.error(err.message || 'Có lỗi xảy ra');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSlotDelete = async (slot: ShiftSlot) => {
    if (!token || !window.confirm(`Bạn có chắc muốn xóa ca trực ${slot.name}?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/shift-slots/${slot.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Xóa ca trực thất bại');
      }
      toast.success('Đã xóa ca trực thành công!');
      fetchStandards();
    } catch (err: any) {
      toast.error(err.message || 'Có lỗi xảy ra');
    }
  };

  const openCreateModal = () => {
    setEditingEntry(null);
    // Default to tomorrow's date
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    const dateStr = tom.toISOString().split('T')[0];

    setFormDate(dateStr);
    setFormIsTrading(true);
    setFormIsHoliday(false);
    setFormIsRecurring(false);
    setFormNote('');
    setModalOpen(true);
  };

  const openCreateModalWithDate = (date: string) => {
    setEditingEntry(null);
    setFormDate(date);
    setFormIsTrading(true);
    setFormIsHoliday(false);
    setFormIsRecurring(false);
    setFormNote('');
    setModalOpen(true);
  };

  const openEditModal = (entry: CalendarEntry) => {
    setEditingEntry(entry);
    if (entry.date.startsWith('*-')) {
      const currentYear = new Date().getFullYear();
      setFormDate(`${currentYear}${entry.date.substring(1)}`);
      setFormIsRecurring(true);
    } else {
      setFormDate(entry.date);
      setFormIsRecurring(false);
    }
    setFormIsTrading(entry.isTradingDay);
    setFormIsHoliday(entry.isHoliday);
    setFormNote(entry.note || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);

    try {
      const url = editingEntry 
        ? `${API_BASE_URL}/api/v1/working-calendar/${editingEntry.date}` 
        : `${API_BASE_URL}/api/v1/working-calendar`;
      
      const method = editingEntry ? 'PUT' : 'POST';
      
      let savedDate = formDate;
      if (formIsRecurring) {
        const [, mm, dd] = formDate.split('-');
        savedDate = `*-${mm}-${dd}`;
      }

      const bodyData = {
        date: savedDate,
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

      toast.success(editingEntry ? 'Cập nhật ngày thành công!' : 'Thêm ngày cấu hình mới thành công!');
      setModalOpen(false);
      fetchCalendarEntries();
    } catch (err: any) {
      toast.error(err.message || 'Có lỗi xảy ra');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (entry: CalendarEntry) => {
    if (!token || !window.confirm(`Bạn có chắc chắn muốn xóa cấu hình ngày ${entry.date}?`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/working-calendar/${entry.date}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Xóa cấu hình ngày thất bại');
      }

      toast.success('Đã xóa cấu hình lịch thành công!');
      fetchCalendarEntries();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi xảy ra');
    }
  };

  const formatDateLabel = (dateStr: string) => {
    if (dateStr.startsWith('*-')) {
      const [, month, day] = dateStr.split('-');
      return `Ngày ${day} tháng ${month} (Lặp lại hàng năm)`;
    }
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
            <List size={16} /> Danh sách ngày đặc biệt ({entries.filter(e => !e.date.startsWith('*-')).length} ngày)
          </button>
          {isAdmin && (
            <button
              onClick={() => setViewMode('standards')}
              className={`btn ${viewMode === 'standards' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '0.85rem' }}
            >
              <Settings size={16} /> Quy chuẩn vận hành (Cấu hình ca & thời gian)
            </button>
          )}
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
        ) : viewMode === 'list' ? (
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
        ) : (
          /* Standards tab */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* Top row: Operational configs side-by-side on desktop */}
            <div style={{ display: 'grid', gap: '32px' }} className="grid grid-cols-1 lg:grid-cols-3">
              
              {/* Auto Shift Generation */}
              <div className="glass-panel lg:col-span-1" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                    <Clock size={18} color="var(--primary-color)" /> Thời gian sinh ca tự động
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Thiết lập mốc thời gian hệ thống tự động quét và khởi tạo ca trực cho ngày mới.
                    </p>
                    <div>
                      <label className="form-label">Giờ sinh ca (HH:MM)</label>
                      <input 
                        type="time" 
                        className="form-input" 
                        value={shiftGenTime} 
                        onChange={(e) => setShiftGenTime(e.target.value)} 
                        disabled={savingStandards}
                        style={{ maxWidth: '240px' }}
                      />
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => saveSystemSetting('shift_generation_time', shiftGenTime)}
                  className="btn btn-primary"
                  style={{ padding: '10px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', alignSelf: 'flex-start', marginTop: '20px' }}
                  disabled={savingStandards}
                >
                  <Save size={16} /> Lưu giờ sinh ca
                </button>
              </div>

              {/* Weekly Rest Days */}
              <div className="glass-panel lg:col-span-2" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                    <Calendar size={18} color="#f59e0b" /> Ngày nghỉ cố định hàng tuần
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Chọn những ngày mặc định được coi là ngày nghỉ. Hệ thống sẽ không sinh ca trực vào các ngày này.
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {[
                        { label: 'Chủ Nhật', value: 0 },
                        { label: 'Thứ Hai', value: 1 },
                        { label: 'Thứ Ba', value: 2 },
                        { label: 'Thứ Tư', value: 3 },
                        { label: 'Thứ Năm', value: 4 },
                        { label: 'Thứ Sáu', value: 5 },
                        { label: 'Thứ Bảy', value: 6 }
                      ].map(day => (
                        <div key={day.value} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          padding: '8px 12px', 
                          background: 'rgba(255,255,255,0.02)', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: '8px',
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                        onClick={() => handleToggleRestDay(day.value)}
                        >
                          <input 
                            type="checkbox"
                            id={`rest-day-${day.value}`}
                            checked={weeklyRestDays.includes(day.value)}
                            onChange={() => {}} // Controlled by wrapper div click handler
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            disabled={savingStandards}
                          />
                          <label htmlFor={`rest-day-${day.value}`} style={{ color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer', margin: 0 }}>
                            {day.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => saveSystemSetting('weekly_rest_days', JSON.stringify(weeklyRestDays))}
                  className="btn btn-primary"
                  style={{ padding: '10px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#f59e0b', borderColor: '#f59e0b', alignSelf: 'flex-start', marginTop: '20px' }}
                  disabled={savingStandards}
                >
                  <Save size={16} /> Lưu ngày nghỉ cố định
                </button>
              </div>

            </div>

            {/* Bottom row: Shift Slots CRUD list */}
            <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Clock size={18} color="#10b981" /> Quản lý Ca trực (Shift Slots)
                </h3>
                <button 
                  onClick={openCreateSlotModal} 
                  className="btn btn-primary" 
                  style={{ padding: '8px 14px', fontSize: '0.8rem', background: '#10b981', borderColor: '#10b981' }}
                >
                  <Plus size={14} /> Thêm ca trực
                </button>
              </div>

                  {loadingStandards ? (
                    <div style={{ color: 'var(--text-secondary)', padding: '20px', textAlign: 'center' }}>Đang tải ca trực...</div>
                  ) : shiftSlots.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>Chưa có ca trực nào được thiết lập.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            <th style={{ padding: '12px 8px' }}>Tên ca</th>
                            <th style={{ padding: '12px 8px' }}>Mã ca</th>
                            <th style={{ padding: '12px 8px' }}>Bắt đầu</th>
                            <th style={{ padding: '12px 8px' }}>Kết thúc</th>
                            <th style={{ padding: '12px 8px' }}>Qua đêm</th>
                            <th style={{ padding: '12px 8px' }}>Trạng thái</th>
                            <th style={{ padding: '12px 8px', textAlign: 'right' }}>Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shiftSlots.map(slot => (
                            <tr key={slot.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                              <td style={{ padding: '14px 8px', fontWeight: 600 }}>{slot.name}</td>
                              <td style={{ padding: '14px 8px' }}><code style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{slot.code}</code></td>
                              <td style={{ padding: '14px 8px' }}>{slot.startTime}</td>
                              <td style={{ padding: '14px 8px' }}>{slot.endTime}</td>
                              <td style={{ padding: '14px 8px' }}>
                                {slot.isOvernight ? (
                                  <span style={{ color: '#f59e0b', fontSize: '0.78rem', fontWeight: 600 }}>Có</span>
                                ) : (
                                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>Không</span>
                                )}
                              </td>
                              <td style={{ padding: '14px 8px' }}>
                                {slot.isActive ? (
                                  <span style={{ color: '#10b981', fontSize: '0.78rem', fontWeight: 600 }}>Hoạt động</span>
                                ) : (
                                  <span style={{ color: '#ef4444', fontSize: '0.78rem', fontWeight: 600 }}>Khóa</span>
                                )}
                              </td>
                              <td style={{ padding: '14px 8px', textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  <button 
                                    onClick={() => openEditSlotModal(slot)} 
                                    className="btn btn-secondary" 
                                    style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                  >
                                    <Edit size={12} />
                                  </button>
                                  <button 
                                    onClick={() => handleSlotDelete(slot)} 
                                    className="btn btn-secondary" 
                                    style={{ padding: '6px 10px', fontSize: '0.75rem', color: '#ef4444' }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '-6px', marginBottom: '4px' }}>
                <input
                  type="checkbox"
                  id="form-is-recurring"
                  checked={formIsRecurring}
                  onChange={(e) => setFormIsRecurring(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  disabled={submitting}
                />
                <label htmlFor="form-is-recurring" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Lặp lại hàng năm (Ví dụ: nghỉ lễ 30/4, 1/5 cố định)
                </label>
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

      {/* Shift Slot Modal */}
      {slotModalOpen && (
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
              onClick={() => setSlotModalOpen(false)}
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
              <Clock size={20} color="#10b981" />
              {editingSlot ? 'Chỉnh sửa Ca trực' : 'Thêm Ca trực mới'}
            </h3>

            <form onSubmit={handleSlotSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="form-label">Tên ca trực <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="vd: Ca Sáng, Ca Trực Đêm..."
                  value={slotName}
                  onChange={(e) => setSlotName(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="form-label">Mã ca trực (Code) <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="vd: CA_SANG, CA_TOI..."
                  value={slotCode}
                  onChange={(e) => setSlotCode(e.target.value)}
                  disabled={!!editingSlot || submitting}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Giờ bắt đầu <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="time"
                    className="form-input"
                    required
                    value={slotStartTime}
                    onChange={(e) => setSlotStartTime(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="form-label">Giờ kết thúc <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="time"
                    className="form-input"
                    required
                    value={slotEndTime}
                    onChange={(e) => setSlotEndTime(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="slot-is-overnight"
                  checked={slotIsOvernight}
                  onChange={(e) => setSlotIsOvernight(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  disabled={submitting}
                />
                <label htmlFor="slot-is-overnight" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Ca trực qua đêm (Vắt sang ngày tiếp theo)
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="slot-is-active"
                  checked={slotIsActive}
                  onChange={(e) => setSlotIsActive(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  disabled={submitting}
                />
                <label htmlFor="slot-is-active" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Ca trực đang hoạt động
                </label>
              </div>

              <div>
                <label className="form-label">Thứ tự sắp xếp</label>
                <input
                  type="number"
                  className="form-input"
                  value={slotSortOrder}
                  onChange={(e) => setSlotSortOrder(Number(e.target.value))}
                  disabled={submitting}
                  min={0}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setSlotModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  disabled={submitting}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, background: '#10b981', borderColor: '#10b981' }}
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
