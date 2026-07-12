// Effective permissions = role defaults OR explicit per-user grants.
// Roles keep their historic abilities; grants only ever ADD capability, so
// existing accounts behave exactly as before until the Super Admin changes them.
export const PERMISSION_KEYS = [
  'canRaiseTickets',
  'canManageTickets',
  'canViewDashboard',
  'canManageUsers',
];

export function effectivePermissions(user) {
  const isSuper = user.role === 'SUPER_ADMIN';
  const isAdmin = isSuper || user.role === 'ADMIN';
  return {
    // Default-on: everyone can raise tickets unless explicitly revoked.
    canRaiseTickets: user.canRaiseTickets !== false,
    canManageTickets: isAdmin || !!user.canManageTickets,
    canViewDashboard: isAdmin || !!user.canViewDashboard,
    canManageUsers: isSuper || !!user.canManageUsers,
  };
}
