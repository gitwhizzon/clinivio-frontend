'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  LayoutDashboard,
  ListOrdered,
  Users,
  CalendarPlus,
  Wallet,
  Pill,
  Bed,
  Hotel,
  FlaskConical,
  Building2,
  Stethoscope,
  Tag,
  Receipt,
  UserCog,
  BarChart3,
  Search,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { iamApi } from '@/lib/api';
import { cn } from '@/lib/utils';

// ─── Role badge colours ───────────────────────────────────────────────────────

const ROLE_COLOURS: Record<string, string> = {
  SUPER_ADMIN:    'bg-purple-500/20 text-purple-300',
  ADMIN:          'bg-blue-500/20 text-blue-300',
  DOCTOR:         'bg-emerald-500/20 text-emerald-300',
  NURSE:          'bg-teal-500/20 text-teal-300',
  RECEPTIONIST:   'bg-sky-500/20 text-sky-300',
  PHARMACIST:     'bg-amber-500/20 text-amber-300',
  LAB_TECHNICIAN: 'bg-rose-500/20 text-rose-300',
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN:    'Super Admin',
  ADMIN:          'Admin',
  DOCTOR:         'Doctor',
  NURSE:          'Nurse',
  RECEPTIONIST:   'Receptionist',
  PHARMACIST:     'Pharmacist',
  LAB_TECHNICIAN: 'Lab Tech',
};

// ─── Nav structure ─────────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
  roles: string[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/hospitals',    label: 'Hospitals',     Icon: Building2,      roles: ['SUPER_ADMIN'] },
      { href: '/dashboard',    label: 'Patient Board', Icon: LayoutDashboard, roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE'] },
      { href: '/doctor-queue', label: 'My Queue',      Icon: ListOrdered,    roles: ['DOCTOR', 'NURSE'] },
    ],
  },
  {
    label: 'Clinical',
    items: [
      { href: '/patients',     label: 'Patients',       Icon: Users,         roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR'] },
      { href: '/appointments', label: 'Appointments',   Icon: CalendarPlus,  roles: ['ADMIN', 'RECEPTIONIST'] },
      { href: '/ipd',          label: 'IPD Admissions', Icon: Bed,           roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE'] },
      { href: '/lab',          label: 'Laboratory',     Icon: FlaskConical,  roles: ['ADMIN', 'LAB_TECHNICIAN', 'DOCTOR', 'NURSE'] },
    ],
  },
  {
    label: 'Billing & Pharmacy',
    items: [
      { href: '/billing',   label: 'Billing Counter', Icon: Wallet, roles: ['ADMIN', 'RECEPTIONIST'] },
      { href: '/pharmacy',  label: 'Pharmacy',        Icon: Pill,   roles: ['ADMIN', 'PHARMACIST'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/doctors',     label: 'Doctors',          Icon: Stethoscope, roles: ['ADMIN'] },
      { href: '/departments', label: 'Departments',      Icon: Tag,         roles: ['ADMIN'] },
      { href: '/billable-services', label: 'Billable Services', Icon: Receipt, roles: ['ADMIN'] },
      { href: '/staff',       label: 'Staff & Passwords', Icon: UserCog,    roles: ['ADMIN'] },
      { href: '/rooms',       label: 'Room Management',  Icon: Hotel,       roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/analytics', label: 'Analytics',   Icon: BarChart3, roles: ['ADMIN', 'DOCTOR'] },
      { href: '/audit',     label: 'Audit Trail', Icon: Search,    roles: ['ADMIN', 'SUPER_ADMIN'] },
    ],
  },
  {
    label: 'Configuration',
    items: [
      {
        href: '/settings',
        label: 'Settings',
        Icon: Settings,
        roles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'PHARMACIST'],
      },
    ],
  },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const role = user?.role ?? '';

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  }

  async function handleLogout() {
    try {
      // Revokes the refresh token server-side (sent automatically via its
      // httpOnly cookie) so it can't mint another access token even if it
      // leaks after this point.
      await iamApi.post('/auth/logout');
    } catch {
      // ignore — we clear client-side auth regardless
    }
    logout();
    router.replace('/login');
  }

  const initials =
    (user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '');

  return (
    <aside
      className={cn(
        'flex-shrink-0 bg-slate-900 flex flex-col transition-all duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* ── Logo + collapse toggle ─────────────────────────────────────── */}
      <div className={cn(
        'flex items-center border-b border-slate-700 transition-all duration-200',
        collapsed ? 'p-3 justify-center' : 'p-4 gap-2 justify-between',
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 bg-blue-500 rounded-lg flex-shrink-0 flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-tight">Megnim</p>
              <p className="text-slate-400 text-[10px] leading-tight truncate">Hospital Management</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className={cn(
            'text-slate-400 hover:text-white hover:bg-slate-700 rounded-md p-1 transition-colors',
            collapsed && 'mt-1',
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5">
        {navGroups.map((group) => {
          const visible = group.items.filter((item) => item.roles.includes(role));
          if (visible.length === 0) return null;

          return (
            <div key={group.label} className="mb-1">
              {!collapsed && (
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {group.label}
                </p>
              )}
              {collapsed && <div className="px-2 pt-2 border-t border-slate-800 first:border-0 first:pt-0" />}

              {visible.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-3 mx-2 px-2 py-2 rounded-lg text-sm transition-colors relative group',
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                    )}
                  >
                    {/* Left accent bar */}
                    {active && (
                      <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-white/60 rounded-full" />
                    )}
                    <item.Icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-white' : '')} />
                    {!collapsed && <span className="truncate">{item.label}</span>}

                    {/* Tooltip in collapsed mode */}
                    {collapsed && (
                      <span className="absolute left-full ml-2 px-2 py-1 bg-slate-700 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                        {item.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* ── User card + logout ─────────────────────────────────────────────── */}
      <div className="border-t border-slate-700 p-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-md p-1.5 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-600 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate leading-tight">
                {user?.firstName} {user?.lastName}
              </p>
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded font-medium',
                ROLE_COLOURS[role] ?? 'bg-slate-600 text-slate-300',
              )}>
                {ROLE_LABELS[role] ?? role}
              </span>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-md p-1.5 transition-colors flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
