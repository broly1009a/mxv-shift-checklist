import { useAuth } from '@/context/AuthContext';

export function usePermissions() {
  const { user } = useAuth();

  if (!user) {
    return {
      isAdmin: false,
      isLeader: false,
      isManager: false,
      isTradeDivision: false,
      isITDivision: false,
      canManageTemplates: false,
      canAccessMarginChange: false,
      canAccessAutoShift: false,
      canAccessHealthChecks: false,
      canResolveIncidents: false,
    };
  }

  const role = user.role;
  const divisionCode = user.division?.code || '';

  const isAdmin = role === 'ADMIN';
  const isLeader = role === 'ADMIN' || role === 'CEO' || role === 'CHAIRMAN';
  const isManager = role === 'DIVISION_DIRECTOR' || role === 'DEPARTMENT_HEAD';

  // Division checks
  const isTradeDivision = divisionCode === 'TRADE_DIVISION';
  const isITDivision = divisionCode === 'IT_DIVISION';

  // Feature checks
  const canManageTemplates = isAdmin || isManager;
  const canAccessMarginChange = isLeader || isTradeDivision;
  const canAccessAutoShift = isAdmin || isITDivision;
  const canAccessHealthChecks = isAdmin || isITDivision;
  const canResolveIncidents = isAdmin || isITDivision || isTradeDivision;

  return {
    isAdmin,
    isLeader,
    isManager,
    isTradeDivision,
    isITDivision,
    canManageTemplates,
    canAccessMarginChange,
    canAccessAutoShift,
    canAccessHealthChecks,
    canResolveIncidents,
  };
}
