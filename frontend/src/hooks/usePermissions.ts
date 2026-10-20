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

  const deptName = user.department?.name || '';
  const parentDeptCode = user.department?.parentDepartmentId?.code || '';

  // Helper chuẩn hóa không dấu để so khớp chính xác tên bộ phận trong CSDL
  const normalizeText = (text: string) =>
    (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .trim();

  const deptNameNorm = normalizeText(deptName);

  // Department checks
  const isTradeDept = deptCode === 'QLGD_OPS' || deptCode === 'QLRR_RISK';
  const isITDept = deptCode === 'IT_CORE' || deptCode === 'IT_RND';

  // Nhận diện Bộ phận Giám sát Giao dịch (Quản lý giám sát giao dịch / Ban Giám sát thị trường):
  // 1. Mã bộ phận chuẩn CSDL: QLGD_OPS (Quản lý giám sát giao dịch) hoặc GSGD
  // 2. Tên bộ phận trong CSDL: Chứa "giam sat giao dich" (bao gồm cả "Quản lý giám sát giao dịch" và "Giám sát giao dịch")
  // 3. Đơn vị cấp Ban trực thuộc: Thuộc Ban Giám sát thị trường (BAN_GSTT) và không phải ban rủi ro (QLRR_RISK)
  const isQlgd =
    deptCode === 'QLGD_OPS' ||
    deptCode === 'GSGD' ||
    deptNameNorm.includes('giam sat giao dich') ||
    (parentDeptCode === 'BAN_GSTT' && deptCode !== 'QLRR_RISK');

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
