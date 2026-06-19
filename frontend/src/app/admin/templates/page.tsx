'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import { 
  Settings, 
  Layers, 
  Plus, 
  Trash2, 
  Save, 
  ChevronRight, 
  Edit,
  ArrowUp,
  ArrowDown,
  X,
  Building2,
  Calendar,
  AlertCircle,
  Link2,
  Cpu,
  FileText,
  Clock
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface Task {
  taskId: string;
  taskName: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  sortOrder: number;
  deadline?: string;
  functionUrl?: string;
  urdReference?: string;
  fileLocation?: string;
  timetable?: string;
  isBotCheck?: boolean;
  botTriggerTime?: string;
}

interface Template {
  _id: string;
  id: string;
  title: string;
  sessionType: 'OPEN' | 'DURING' | 'CLOSE';
  departmentId: {
    _id: string;
    name: string;
    code: string;
  };
  shiftSlotId?: {
    _id: string;
    name: string;
    code: string;
    startTime: string;
    endTime: string;
  } | null;
  isActive?: boolean;
  tasks: Task[];
}

export default function AdminTemplatesPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'ADMIN';

  const [templates, setTemplates] = useState<Template[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [shiftSlots, setShiftSlots] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states for adding tasks
  const [newTaskId, setNewTaskId] = useState('');
  const [newTaskName, setNewTaskName] = useState('');
  const [newPriority, setNewPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [newDeadline, setNewDeadline] = useState('');
  const [newFunctionUrl, setNewFunctionUrl] = useState('');
  const [newUrdReference, setNewUrdReference] = useState('');
  const [newFileLocation, setNewFileLocation] = useState('');
  const [newTimetable, setNewTimetable] = useState('');
  const [newIsBotCheck, setNewIsBotCheck] = useState(false);
  const [newBotTriggerTime, setNewBotTriggerTime] = useState('');
  
  // Modal states for Template CRUD
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplateInfo, setEditingTemplateInfo] = useState<Template | null>(null);
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateSession, setTemplateSession] = useState<'OPEN' | 'DURING' | 'CLOSE'>('OPEN');
  const [templateDeptId, setTemplateDeptId] = useState('');
  const [templateShiftSlotId, setTemplateShiftSlotId] = useState('');
  const [templateIsActive, setTemplateIsActive] = useState(true);
  const [templateSubmitting, setTemplateSubmitting] = useState(false);
  const [templateErrors, setTemplateErrors] = useState<{ title?: string; dept?: string }>({});

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Auto-toast effects when success/error state changes
  useEffect(() => {
    if (success) {
      toast.success(success);
      setSuccess('');
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      setError('');
    }
  }, [error]);

  // Redirect if not admin or manager
  useEffect(() => {
    if (user) {
      const allowedRoles = ['ADMIN', 'CHAIRMAN', 'CEO', 'DIVISION_DIRECTOR', 'DEPARTMENT_HEAD'];
      if (!allowedRoles.includes(user.role)) {
        router.push('/dashboard');
      }
    }
  }, [user, router]);

  const fetchDepartments = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/departments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setDepartments(data);
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  const fetchShiftSlots = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/shift-slots`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setShiftSlots(data);
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  const fetchTemplates = useCallback(async (selectId?: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setTemplates(data);
      
      // Auto-select template
      if (data.length > 0) {
        if (selectId) {
          const found = data.find((t: any) => t._id === selectId);
          setSelectedTemplate(found || data[0]);
        } else {
          setSelectedTemplate(data[0]);
        }
      } else {
        setSelectedTemplate(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTemplates();
    fetchDepartments();
    fetchShiftSlots();
  }, [fetchTemplates, fetchDepartments, fetchShiftSlots]);

  const handleSelectTemplate = (tpl: Template) => {
    setSelectedTemplate(tpl);
    setError('');
    setSuccess('');
    setNewTaskId('');
    setNewTaskName('');
    setNewFunctionUrl('');
    setNewUrdReference('');
    setNewFileLocation('');
    setNewTimetable('');
    setNewIsBotCheck(false);
    setNewBotTriggerTime('');
  };

  // ─── Template CRUD Modals ───────────────────────────────────────────────────
  const openCreateTemplateModal = () => {
    setEditingTemplateInfo(null);
    setTemplateTitle('');
    setTemplateSession('OPEN');
    setTemplateDeptId(departments[0]?._id || '');
    setTemplateShiftSlotId('');
    setTemplateIsActive(true);
    setTemplateErrors({});
    setError('');
    setSuccess('');
    setTemplateModalOpen(true);
  };

  const openEditTemplateModal = (tpl: Template) => {
    setEditingTemplateInfo(tpl);
    setTemplateTitle(tpl.title);
    setTemplateSession(tpl.sessionType);
    setTemplateDeptId(tpl.departmentId?._id || (tpl.departmentId as any) || '');
    setTemplateShiftSlotId(tpl.shiftSlotId?._id || (tpl.shiftSlotId as any) || '');
    setTemplateIsActive(tpl.isActive !== false);
    setTemplateErrors({});
    setError('');
    setSuccess('');
    setTemplateModalOpen(true);
  };

  const closeTemplateModal = () => {
    setTemplateModalOpen(false);
    setEditingTemplateInfo(null);
    setTemplateErrors({});
  };

  const handleTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: { title?: string; dept?: string } = {};
    if (!templateTitle.trim()) {
      errs.title = 'Tiêu đề không được để trống';
    }
    if (!templateDeptId) {
      errs.dept = 'Vui lòng chọn phòng ban';
    }
    if (Object.keys(errs).length > 0) {
      setTemplateErrors(errs);
      return;
    }

    setTemplateSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const body = {
        title: templateTitle.trim(),
        sessionType: templateSession,
        departmentId: templateDeptId,
        shiftSlotId: templateShiftSlotId || null,
        isActive: templateIsActive,
        tasks: editingTemplateInfo ? editingTemplateInfo.tasks : []
      };

      const method = editingTemplateInfo ? 'PUT' : 'POST';
      const url = editingTemplateInfo 
        ? `${API_BASE_URL}/api/v1/templates/${editingTemplateInfo._id}`
        : `${API_BASE_URL}/api/v1/templates`;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Thao tác mẫu checklist thất bại');
      }

      const savedTpl = await res.json();
      setSuccess(editingTemplateInfo ? 'Cập nhật mẫu thành công!' : 'Tạo mẫu mới thành công!');
      
      // Refresh list and keep selection
      await fetchTemplates(savedTpl._id);
      setTimeout(() => closeTemplateModal(), 800);
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setTemplateSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (tpl: Template) => {
    if (!window.confirm(`Bạn có chắc chắn muốn XÓA mẫu checklist "${tpl.title}"?\n\nHành động này không thể hoàn tác.`)) return;
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/templates/${tpl._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Xóa mẫu checklist thất bại');
      }

      setSuccess(`Đã xóa mẫu checklist "${tpl.title}" thành công.`);
      fetchTemplates();
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối máy chủ');
    }
  };

  // ─── Task CRUD ─────────────────────────────────────────────────────────────
  const handleAddTask = () => {
    if (!selectedTemplate) return;
    if (!newTaskId || !newTaskName) {
      setError('Vui lòng điền mã tác vụ và nội dung công việc');
      return;
    }
    // Check duplication
    if (selectedTemplate.tasks.some(t => t.taskId === newTaskId)) {
      setError('Mã tác vụ đã tồn tại trong mẫu checklist này');
      return;
    }

    const newTask: Task = {
      taskId: newTaskId.trim(),
      taskName: newTaskName.trim(),
      priority: newPriority,
      sortOrder: selectedTemplate.tasks.length + 1,
      deadline: newDeadline.trim() || undefined,
      functionUrl: newFunctionUrl.trim() || undefined,
      urdReference: newUrdReference.trim() || undefined,
      fileLocation: newFileLocation.trim() || undefined,
      timetable: newTimetable.trim() || undefined,
      isBotCheck: newIsBotCheck || undefined,
      botTriggerTime: newIsBotCheck ? (newBotTriggerTime.trim() || undefined) : undefined
    };

    const updatedTasks = [...selectedTemplate.tasks, newTask];
    setSelectedTemplate({
      ...selectedTemplate,
      tasks: updatedTasks
    });

    setNewTaskId('');
    setNewTaskName('');
    setNewPriority('MEDIUM');
    setNewDeadline('');
    setNewFunctionUrl('');
    setNewUrdReference('');
    setNewFileLocation('');
    setNewTimetable('');
    setNewIsBotCheck(false);
    setNewBotTriggerTime('');
    setError('');
  };

  const handleDeleteTask = (taskId: string) => {
    if (!selectedTemplate) return;
    const updatedTasks = selectedTemplate.tasks.filter(t => t.taskId !== taskId);
    // Recalculate sortOrders
    const sorted = updatedTasks.map((t, idx) => ({
      ...t,
      sortOrder: idx + 1
    }));
    setSelectedTemplate({
      ...selectedTemplate,
      tasks: sorted
    });
  };

  const handleMoveTask = (index: number, direction: 'up' | 'down') => {
    if (!selectedTemplate) return;
    const tasks = [...selectedTemplate.tasks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= tasks.length) return;

    // Swap
    const temp = tasks[index];
    tasks[index] = tasks[targetIndex];
    tasks[targetIndex] = temp;

    // Update sortOrder values
    const updated = tasks.map((t, idx) => ({
      ...t,
      sortOrder: idx + 1
    }));

    setSelectedTemplate({
      ...selectedTemplate,
      tasks: updated
    });
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate || !token) return;
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/templates/${selectedTemplate._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: selectedTemplate.title,
          sessionType: selectedTemplate.sessionType,
          departmentId: selectedTemplate.departmentId?._id || selectedTemplate.departmentId,
          shiftSlotId: selectedTemplate.shiftSlotId?._id || selectedTemplate.shiftSlotId || null,
          isActive: selectedTemplate.isActive !== false,
          tasks: selectedTemplate.tasks
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Cập nhật mẫu checklist thất bại');
      }

      setSuccess('Đã lưu cấu hình mẫu checklist thành công!');
      fetchTemplates(selectedTemplate._id);
    } catch (err: any) {
      setError(err.message || 'Lỗi xảy ra');
    }
  };

  const getSessionBadge = (type: string) => {
    switch (type) {
      case 'OPEN': return <span className="badge badge-low">Mở Cửa</span>;
      case 'DURING': return <span className="badge badge-medium">Trong Phiên</span>;
      default: return <span className="badge badge-high">Đóng Cửa</span>;
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'LOW': return <span className="badge badge-low">Thấp</span>;
      case 'MEDIUM': return <span className="badge badge-medium">T.Bình</span>;
      case 'HIGH': return <span className="badge badge-high">Cao</span>;
      default: return <span className="badge badge-critical">Khẩn Cấp</span>;
    }
  };

  return (
    <ProtectedRoute>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: '4px' }}>
              Quản Trị Mẫu Checklist Vận Hành
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Điều chỉnh, thêm mới, phân cấp hoặc sắp xếp danh sách các mẫu checklist nghiệp vụ chuẩn của Sở.
            </p>
          </div>
          {isAdmin && (
            <button onClick={openCreateTemplateModal} className="btn btn-primary" style={{ padding: '12px 20px' }}>
              <Plus size={18} /> Thêm mẫu mới
            </button>
          )}
        </div>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 items-start">
          {/* Templates list panel */}
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
              <Layers size={18} color="var(--color-accent)" /> Các mẫu checklist
            </h3>
            {loading ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Đang tải mẫu...</div>
            ) : templates.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>Chưa có mẫu nào.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {templates.map(tpl => (
                  <button
                    key={tpl._id}
                    onClick={() => handleSelectTemplate(tpl)}
                    style={{
                      background: selectedTemplate?._id === tpl._id ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      color: selectedTemplate?._id === tpl._id ? '#fff' : 'var(--text-secondary)',
                      fontWeight: selectedTemplate?._id === tpl._id ? 700 : 500,
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s ease',
                      borderLeft: selectedTemplate?._id === tpl._id ? '3px solid var(--color-accent)' : '3px solid transparent',
                      opacity: tpl.isActive === false ? 0.5 : 1
                    }}
                  >
                    <span style={{ fontSize: '0.85rem', flex: 1, paddingRight: '8px' }}>
                      {tpl.title} {tpl.isActive === false && <strong style={{ fontSize: '0.72rem', color: '#ef4444' }}>(Tắt)</strong>}
                    </span>
                    <ChevronRight size={14} style={{ opacity: selectedTemplate?._id === tpl._id ? 1 : 0.3 }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Active template workspace panel */}
          {selectedTemplate ? (
            <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Template Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    {selectedTemplate.title}
                  </h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <span>Phòng trực: <strong>{selectedTemplate.departmentId?.name || 'Không xác định'}</strong></span>
                    <span>•</span>
                    <span>Phiên trực: {getSessionBadge(selectedTemplate.sessionType)}</span>
                    {selectedTemplate.shiftSlotId && (
                      <>
                        <span>•</span>
                        <span>Ca liên kết: <strong>{selectedTemplate.shiftSlotId.name} ({selectedTemplate.shiftSlotId.startTime} - {selectedTemplate.shiftSlotId.endTime})</strong></span>
                      </>
                    )}
                    <span>•</span>
                    <span>Cơ chế: {selectedTemplate.isActive !== false ? <span style={{ color: '#10b981', fontWeight: 600 }}>Hoạt động</span> : <span style={{ color: '#ef4444', fontWeight: 600 }}>Tạm ngừng</span>}</span>
                  </div>
                </div>

                {isAdmin && (
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                      onClick={() => openEditTemplateModal(selectedTemplate)} 
                      className="btn btn-secondary" 
                      style={{ padding: '12px 20px' }}
                    >
                      <Edit size={16} /> Sửa thông tin mẫu
                    </button>
                    <button 
                      onClick={() => handleDeleteTemplate(selectedTemplate)} 
                      className="btn btn-secondary" 
                      style={{ padding: '12px 20px', color: '#ef4444' }}
                    >
                      <Trash2 size={16} /> Xóa mẫu
                    </button>
                    <button 
                      onClick={handleSaveTemplate} 
                      className="btn btn-primary" 
                      style={{ padding: '12px 24px' }}
                    >
                      <Save size={16} /> Lưu Cấu Hình Tác Vụ
                    </button>
                  </div>
                )}
              </div>

              {/* Add Task Subform */}
              {isAdmin && (
                <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.01)' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={16} color="var(--color-primary)" /> Thêm tác vụ mới vào danh sách
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Mã Tác Vụ *</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="vd: it_open_06"
                          value={newTaskId}
                          onChange={(e) => setNewTaskId(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Nội dung công việc *</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Nhập nội dung tác vụ..."
                          value={newTaskName}
                          onChange={(e) => setNewTaskName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Độ Ưu Tiên *</label>
                        <select
                          className="form-input"
                          value={newPriority}
                          onChange={(e) => setNewPriority(e.target.value as any)}
                          style={{ background: 'var(--bg-app)' }}
                        >
                          <option value="LOW">THẤP</option>
                          <option value="MEDIUM">T.BÌNH</option>
                          <option value="HIGH">CAO</option>
                          <option value="CRITICAL">KHẨN CẤP</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Hạn Chót</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="vd: 16:30"
                          value={newDeadline}
                          onChange={(e) => setNewDeadline(e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Function URL</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="http://..."
                          value={newFunctionUrl}
                          onChange={(e) => setNewFunctionUrl(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>URD Reference</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="URD-XXX"
                          value={newUrdReference}
                          onChange={(e) => setNewUrdReference(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Đường dẫn file</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="vd: /var/log/..."
                          value={newFileLocation}
                          onChange={(e) => setNewFileLocation(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Khung giờ</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="vd: 08:00 - 10:00"
                          value={newTimetable}
                          onChange={(e) => setNewTimetable(e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '20px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          id="newIsBotCheck"
                          checked={newIsBotCheck}
                          onChange={(e) => setNewIsBotCheck(e.target.checked)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <label htmlFor="newIsBotCheck" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                          Sử dụng Bot Check tự động
                        </label>
                      </div>

                      {newIsBotCheck && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Giờ trigger:</span>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="vd: 08:30"
                            value={newBotTriggerTime}
                            onChange={(e) => setNewBotTriggerTime(e.target.value)}
                            style={{ width: '100px', padding: '6px 12px' }}
                          />
                        </div>
                      )}

                      <button type="button" onClick={handleAddTask} className="btn btn-success" style={{ marginLeft: 'auto', padding: '10px 24px' }}>
                        <Plus size={16} /> Thêm tác vụ
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tasks List Table */}
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Settings size={18} color="var(--color-accent)" /> Danh sách tác vụ đang có ({selectedTemplate.tasks?.length || 0} tác vụ)
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selectedTemplate.tasks?.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Không có tác vụ nào trong mẫu này.</div>
                  ) : (
                    selectedTemplate.tasks.map((task, index) => (
                      <div key={task.taskId} style={{
                        padding: '16px',
                        borderRadius: '8px',
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '16px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', width: '30px' }}>
                              #{index + 1}
                            </span>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {task.taskName}
                              </p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                <span>Mã: <strong>{task.taskId}</strong></span>
                                <span>•</span>
                                <span>Ưu tiên: {getPriorityBadge(task.priority)}</span>
                                {task.deadline && (
                                  <>
                                    <span>•</span>
                                    <span>Hạn chót: <strong style={{ color: '#ef4444' }}>{task.deadline}</strong></span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Reordering and Actions */}
                          {isAdmin && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => handleMoveTask(index, 'up')}
                                disabled={index === 0}
                                style={{ padding: '6px', background: 'transparent', border: 'none', color: index === 0 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)', cursor: index === 0 ? 'not-allowed' : 'pointer' }}
                              >
                                <ArrowUp size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveTask(index, 'down')}
                                disabled={index === selectedTemplate.tasks.length - 1}
                                style={{ padding: '6px', background: 'transparent', border: 'none', color: index === selectedTemplate.tasks.length - 1 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)', cursor: index === selectedTemplate.tasks.length - 1 ? 'not-allowed' : 'pointer' }}
                              >
                                <ArrowDown size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTask(task.taskId)}
                                style={{ padding: '6px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Extra fields snapshot view */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '0.75rem', paddingLeft: '42px' }}>
                          {task.functionUrl && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(59, 130, 246, 0.06)', color: '#3b82f6', padding: '2px 8px', borderRadius: '4px' }}>
                              <Link2 size={12} /> URL: {task.functionUrl}
                            </span>
                          )}
                          {task.urdReference && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(139, 92, 246, 0.06)', color: '#8b5cf6', padding: '2px 8px', borderRadius: '4px' }}>
                              <FileText size={12} /> URD: {task.urdReference}
                            </span>
                          )}
                          {task.fileLocation && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(245, 158, 11, 0.06)', color: '#f59e0b', padding: '2px 8px', borderRadius: '4px' }}>
                              <FileText size={12} /> File: {task.fileLocation}
                            </span>
                          )}
                          {task.timetable && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.06)', color: '#10b981', padding: '2px 8px', borderRadius: '4px' }}>
                              <Clock size={12} /> Khung giờ: {task.timetable}
                            </span>
                          )}
                          {task.isBotCheck && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(236, 72, 153, 0.06)', color: '#ec4899', padding: '2px 8px', borderRadius: '4px' }}>
                              <Cpu size={12} /> Bot Check {task.botTriggerTime ? `(${task.botTriggerTime})` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Vui lòng chọn hoặc tạo mới một mẫu checklist bên trái để bắt đầu cấu hình.
            </div>
          )}
        </div>
      </div>

      {/* Template Create/Edit Modal */}
      {templateModalOpen && (
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
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '24px', position: 'relative' }}>
              <button
                onClick={closeTemplateModal}
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

              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={20} color="var(--color-primary)" />
                {editingTemplateInfo ? 'Cập Nhật Thông Tin Mẫu' : 'Khởi Tạo Mẫu Checklist Mới'}
              </h3>

              <form onSubmit={handleTemplateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Title */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Tên / Tiêu đề mẫu checklist <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="vd: Checklist Mở Cửa - Ban IT"
                    required
                    value={templateTitle}
                    onChange={(e) => setTemplateTitle(e.target.value)}
                    disabled={templateSubmitting}
                  />
                  {templateErrors.title && (
                    <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={12} /> {templateErrors.title}
                    </p>
                  )}
                </div>

                {/* Department */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Phòng ban chịu trách nhiệm <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    className="form-input"
                    value={templateDeptId}
                    onChange={(e) => setTemplateDeptId(e.target.value)}
                    style={{ background: 'var(--bg-app)', cursor: 'pointer' }}
                    disabled={templateSubmitting}
                  >
                    <option value="">-- Chọn phòng ban --</option>
                    {departments.map(dept => (
                      <option key={dept._id} value={dept._id}>{dept.name} ({dept.code})</option>
                    ))}
                  </select>
                  {templateErrors.dept && (
                    <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={12} /> {templateErrors.dept}
                    </p>
                  )}
                </div>

                {/* Session Type */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Phiên vận hành <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    className="form-input"
                    value={templateSession}
                    onChange={(e) => setTemplateSession(e.target.value as any)}
                    style={{ background: 'var(--bg-app)', cursor: 'pointer' }}
                    disabled={templateSubmitting}
                  >
                    <option value="OPEN">MỞ CỬA</option>
                    <option value="DURING">TRONG PHIÊN</option>
                    <option value="CLOSE">ĐÓNG CỬA</option>
                  </select>
                </div>

                {/* Shift Slot Dropdown */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Ca trực tương ứng
                  </label>
                  <select
                    className="form-input"
                    value={templateShiftSlotId}
                    onChange={(e) => setTemplateShiftSlotId(e.target.value)}
                    style={{ background: 'var(--bg-app)', cursor: 'pointer' }}
                    disabled={templateSubmitting}
                  >
                    <option value="">-- Chọn ca trực (Không bắt buộc) --</option>
                    {shiftSlots.map(slot => (
                      <option key={slot._id} value={slot._id}>
                        {slot.name} ({slot.startTime} - {slot.endTime})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Is Active toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '4px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', flex: 1, cursor: 'pointer' }} htmlFor="templateIsActive">
                    Trạng thái hoạt động (Active)
                  </label>
                  <input
                    type="checkbox"
                    id="templateIsActive"
                    checked={templateIsActive}
                    onChange={(e) => setTemplateIsActive(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    disabled={templateSubmitting}
                  />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={closeTemplateModal}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    disabled={templateSubmitting}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={templateSubmitting}
                  >
                    <Save size={16} />
                    {templateSubmitting ? 'Đang lưu...' : (editingTemplateInfo ? 'Cập nhật' : 'Tạo mới')}
                  </button>
                </div>
              </form>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
