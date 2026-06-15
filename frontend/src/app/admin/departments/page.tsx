'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import { Building2, Plus, Edit, Trash2, X, Save, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Department {
  _id: string;
  name: string;
  code: string;
}

// ─── Validation ────────────────────────────────────────────────────────────────
function validateForm(name: string, code: string, departments: Department[], editingId?: string) {
  const errors: { name?: string; code?: string } = {};

  if (!name.trim()) {
    errors.name = 'Tên phòng ban không được để trống';
  } else if (name.trim().length < 3) {
    errors.name = 'Tên phòng ban tối thiểu 3 ký tự';
  }

  if (!code.trim()) {
    errors.code = 'Mã phòng ban không được để trống';
  } else if (!/^[A-Z0-9_]+$/.test(code.trim())) {
    errors.code = 'Mã phòng ban chỉ được chứa CHỮ HOA, số và dấu gạch dưới (VD: IT_CORE)';
  } else if (code.trim().length < 2) {
    errors.code = 'Mã phòng ban tối thiểu 2 ký tự';
  } else {
    // Check duplicate code
    const duplicate = departments.find(
      (d) => d.code.toUpperCase() === code.trim().toUpperCase() && d._id !== editingId
    );
    if (duplicate) {
      errors.code = `Mã phòng ban "${code.trim()}" đã tồn tại trong hệ thống`;
    }
  }

  return errors;
}

export default function AdminDepartmentsPage() {
  const { user, token } = useAuth();
  const router = useRouter();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; code?: string }>({});
  const [apiError, setApiError] = useState('');
  const [apiSuccess, setApiSuccess] = useState('');

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'ADMIN') router.push('/dashboard');
  }, [user, router]);

  const fetchDepartments = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/departments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDepartments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  // ─── Open Modals ──────────────────────────────────────────────────────────────
  const openAddModal = () => {
    setEditingDept(null);
    setName('');
    setCode('');
    setFieldErrors({});
    setApiError('');
    setApiSuccess('');
    setModalOpen(true);
  };

  const openEditModal = (dept: Department) => {
    setEditingDept(dept);
    setName(dept.name);
    setCode(dept.code);
    setFieldErrors({});
    setApiError('');
    setApiSuccess('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingDept(null);
    setFieldErrors({});
  };

  // ─── Auto-format Code field ────────────────────────────────────────────────
  const handleCodeChange = (val: string) => {
    setCode(val.toUpperCase().replace(/[^A-Z0-9_]/g, ''));
  };

  // ─── Submit Create/Edit ────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    setApiSuccess('');

    const errors = validateForm(name, code, departments, editingDept?._id);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);

    try {
      const method = editingDept ? 'PUT' : 'POST';
      const url = editingDept
        ? `${API_BASE_URL}/api/v1/departments/${editingDept._id}`
        : `${API_BASE_URL}/api/v1/departments`;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim(), code: code.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Thao tác thất bại');
      }

      setApiSuccess(editingDept ? 'Cập nhật phòng ban thành công!' : 'Tạo phòng ban mới thành công!');
      fetchDepartments();
      setTimeout(() => closeModal(), 1000);
    } catch (err: any) {
      setApiError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (dept: Department) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn XÓA phòng ban "${dept.name}"?\n\nLưu ý: Thao tác này có thể ảnh hưởng đến tài khoản và mẫu checklist đang được gắn với phòng ban này.`
      )
    )
      return;

    setDeletingId(dept._id);
    setApiError('');
    setApiSuccess('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/departments/${dept._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Xóa thất bại');
      }
      setApiSuccess(`Đã xóa phòng ban "${dept.name}".`);
      fetchDepartments();
    } catch (err: any) {
      setApiError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <ProtectedRoute>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.025em', marginBottom: '4px' }}>
              Quản Lý Phòng Ban Vận Hành
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Thêm, chỉnh sửa hoặc xóa các phòng ban trong hệ thống MXV Shift Checklist.
            </p>
          </div>
          <button onClick={openAddModal} className="btn btn-primary" style={{ padding: '12px 20px' }}>
            <Plus size={18} /> Thêm phòng ban mới
          </button>
        </div>

        {/* Global messages */}
        {apiError && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '8px', color: '#ef4444', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} /> {apiError}
          </div>
        )}
        {apiSuccess && (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px 16px', borderRadius: '8px', color: 'var(--color-primary)', fontSize: '0.875rem' }}>
            {apiSuccess}
          </div>
        )}

        {/* Table */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>Đang tải dữ liệu...</div>
          ) : departments.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
              Chưa có phòng ban nào. Nhấn <strong>"Thêm phòng ban mới"</strong> để bắt đầu.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '12px 16px' }}>#</th>
                    <th style={{ padding: '12px 16px' }}>Tên Phòng Ban</th>
                    <th style={{ padding: '12px 16px' }}>Mã Phòng Ban (Code)</th>
                    <th style={{ padding: '12px 16px' }}>Hành Động</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((dept, idx) => (
                    <tr
                      key={dept._id}
                      style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.005)' }}
                    >
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#fff' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <Building2 size={16} color="var(--color-accent)" />
                          {dept.name}
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
                          letterSpacing: '0.05em'
                        }}>
                          {dept.code}
                        </code>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            onClick={() => openEditModal(dept)}
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          >
                            <Edit size={14} /> Sửa
                          </button>
                          <button
                            onClick={() => handleDelete(dept)}
                            disabled={deletingId === dept._id}
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#ef4444', opacity: deletingId === dept._id ? 0.6 : 1 }}
                          >
                            <Trash2 size={14} /> {deletingId === dept._id ? 'Đang xóa...' : 'Xóa'}
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

      {/* Modal */}
      {modalOpen && (
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
          zIndex: 9999, // Đè lên tất cả
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '460px',
            background: '#0d1326', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', padding: '32px',
            display: 'flex', flexDirection: 'column', gap: '20px',
            margin: 'auto' // Căn giữa thông minh và tránh bị cut-off khi màn hình nhỏ
            }}>
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={20} color="var(--color-accent)" />
                  {editingDept ? 'Chỉnh sửa phòng ban' : 'Thêm phòng ban mới'}
                </h2>
                <button onClick={closeModal} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              {/* API errors inside modal */}
              {apiError && !submitting && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 14px', borderRadius: '8px', color: '#ef4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={14} /> {apiError}
                </div>
              )}
              {apiSuccess && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px 14px', borderRadius: '8px', color: 'var(--color-primary)', fontSize: '0.85rem' }}>
                  {apiSuccess}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Name field */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Tên phòng ban <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="VD: IT Vận Hành Core"
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

                {/* Code field */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Mã phòng ban (Code) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="VD: IT_CORE"
                    value={code}
                    onChange={(e) => {
                      handleCodeChange(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, code: undefined }));
                    }}
                    style={{
                      borderColor: fieldErrors.code ? '#ef4444' : undefined,
                      fontFamily: 'monospace',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase'
                    }}
                    disabled={submitting || !!editingDept} // Không cho đổi code khi edit
                  />
                  {editingDept && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '5px' }}>
                      ⚠ Mã phòng ban không thể thay đổi sau khi tạo.
                    </p>
                  )}
                  {fieldErrors.code && (
                    <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={12} /> {fieldErrors.code}
                    </p>
                  )}
                  {!fieldErrors.code && !editingDept && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '5px' }}>
                      Chỉ CHỮ HOA, số và dấu gạch dưới. VD: IT_CORE, RE_OPS
                    </p>
                  )}
                </div>

                {/* Actions */}
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
                    {submitting ? 'Đang lưu...' : (editingDept ? 'Cập nhật' : 'Tạo mới')}
                  </button>
                </div>
              </form>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
