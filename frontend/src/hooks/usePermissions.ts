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

  // Department checks
  const isTradeDept = deptCode === 'QLGD_OPS' || deptCode === 'QLRR_RISK';
  const isITDept = deptCode === 'IT_CORE' || deptCode === 'IT_RND';

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
    canManageTemplates,
    canAccessMarginChange,
    canAccessAutoShift,
    canAccessHealthChecks,
    canResolveIncidents,
    canViewChecklist,
    canEditChecklist,
  };
}
