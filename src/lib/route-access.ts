/**
 * Which roles may view which dashboard routes, and where to send a role that
 * lands somewhere it isn't allowed. This is the client-side UX layer only —
 * the real security boundary is the backend's RolesGuard on every API call,
 * which rejects unauthorized requests regardless of what the frontend does.
 * This just makes sure an authenticated-but-wrong-role user (e.g. a hospital
 * ADMIN who manually navigates to /hospitals) gets redirected immediately
 * instead of seeing an admin page shell with an empty/error state.
 *
 * Keep in sync with Sidebar.tsx's navGroups roles — duplicated deliberately
 * rather than sharing one array, so a change to nav *visibility* can't
 * silently change access *enforcement* (or vice versa) without a second,
 * explicit edit here.
 */
const ROUTE_ROLES: { href: string; roles: string[] }[] = [
  { href: '/hospitals', roles: ['SUPER_ADMIN'] },
  { href: '/dashboard', roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE'] },
  { href: '/doctor-queue', roles: ['DOCTOR', 'NURSE'] },
  { href: '/patients', roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR'] },
  { href: '/appointments', roles: ['ADMIN', 'RECEPTIONIST'] },
  { href: '/ipd', roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE'] },
  { href: '/lab', roles: ['ADMIN', 'LAB_TECHNICIAN', 'DOCTOR', 'NURSE'] },
  { href: '/billing', roles: ['ADMIN', 'RECEPTIONIST'] },
  { href: '/pharmacy', roles: ['ADMIN', 'PHARMACIST'] },
  { href: '/doctors', roles: ['ADMIN'] },
  { href: '/departments', roles: ['ADMIN'] },
  { href: '/billable-services', roles: ['ADMIN'] },
  { href: '/staff', roles: ['ADMIN'] },
  { href: '/rooms', roles: ['ADMIN'] },
  { href: '/analytics', roles: ['ADMIN', 'DOCTOR'] },
  { href: '/audit', roles: ['ADMIN', 'SUPER_ADMIN'] },
  { href: '/consultation', roles: ['ADMIN', 'DOCTOR', 'NURSE'] },
  {
    href: '/settings',
    roles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'PHARMACIST'],
  },
];

/** Where each role lands after login / after being redirected off a page it can't access. */
const DEFAULT_ROUTE_FOR_ROLE: Record<string, string> = {
  SUPER_ADMIN: '/hospitals',
  LAB_TECHNICIAN: '/lab',
  PHARMACIST: '/pharmacy',
};

export function defaultRouteForRole(role: string | undefined): string {
  return (role && DEFAULT_ROUTE_FOR_ROLE[role]) || '/dashboard';
}

/**
 * True if `role` may view `pathname`. Matches by prefix (so /patients/abc123
 * inherits /patients' roles) — routes with no entry here are allowed for any
 * authenticated role, since they're either public-within-the-dashboard or
 * not yet role-restricted by design.
 */
export function isRouteAllowedForRole(pathname: string, role: string | undefined): boolean {
  if (!role) return false;
  const entry = ROUTE_ROLES.find(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
  );
  if (!entry) return true;
  return entry.roles.includes(role);
}
