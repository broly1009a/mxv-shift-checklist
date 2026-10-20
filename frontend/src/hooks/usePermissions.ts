import { useAuth } from '@/context/AuthContext';

export function usePermissions() {
  const { user } = useAuth();

  if (!user) {
    return {
      isAdmin: false,
      isLeader: false,
      isManager: false,
      isTradeDept: false,
      isITDept: false,
      isQlgd: false,
      canManageTemplates: false,
      canAccessMarginChange: false,
      canAccessAutoShift: false,
      canAccessHealthChecks: false,
      canResolveIncidents: false,
    };
  }

  const role = user.role;
  const deptCode = user.department?.code || '';
  const permissions = user.permissions || [];

  const isAdmin = role === 'ADMIN';
  const isLeader = role === 'ADMIN' || role === 'CEO' || role === 'CHAIRMAN';
  const isManager = role === 'DEPARTMENT_HEAD';

  const parentDeptCode = user.department?.parentDepartmentId?.code || '';

  // Department checks
  const isTradeDept =
    deptCode === 'QLGD_OPS' ||
    deptCode === 'BAN_CSTT' ||
    deptCode === 'BAN_GSTT' ||
    deptCode === 'QLRR_RISK';
  const isITDept = deptCode === 'IT_CORE' || deptCode === 'IT_RND';

  // Nhận diện người dùng áp dụng Menu Sidebar mới (Khối QLGD_OPS và BAN_CSTT / BAN_GSTT):
  // Sử dụng trực tiếp mã phòng ban (code) từ CSDL, không phỏng đoán chuỗi:
  const isQlgd =
    deptCode === 'QLGD_OPS' ||
    deptCode === 'BAN_CSTT' ||
    deptCode === 'BAN_GSTT' ||
    (parentDeptCode === 'BAN_GSTT' && deptCode !== 'QLRR_RISK') ||
    (parentDeptCode === 'BAN_CSTT' && deptCode !== 'QLRR_RISK');

  // Dynamic Feature checks
  const canManageTemplates = isAdmin || permissions.includes('MANAGE_TEMPLATES');
  const canAccessMarginChange = isAdmin || permissions.includes('ACCESS_MARGIN_CHANGE');
  const canAccessAutoShift = isAdmin || permissions.includes('ACCESS_AUTO_SHIFT');
  const canAccessHealthChecks = isAdmin || permissions.includes('ACCESS_HEALTH_CHECKS');
  const canResolveIncidents = isAdmin || permissions.includes('RESOLVE_INCIDENTS');
  const canViewChecklist = isAdmin || permissions.includes('VIEW_CHECKLIST');
  const canEditChecklist = isAdmin || permissions.includes('EDIT_CHECKLIST');

  return {
    isAdmin,
    isLeader,
    isManager,
    isTradeDept,
    isITDept,
    isQlgd,
    canManageTemplates,
    canAccessMarginChange,
    canAccessAutoShift,
    canAccessHealthChecks,
    canResolveIncidents,
    canViewChecklist,
    canEditChecklist,
  };
}
