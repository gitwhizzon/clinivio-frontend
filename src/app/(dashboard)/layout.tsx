'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { iamApi } from '@/lib/api';
import { defaultRouteForRole, isRouteAllowedForRole } from '@/lib/route-access';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, tenantProfile, setTenantProfile } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  // The backend's RolesGuard is the real security boundary (an unauthorized
  // fetch is rejected with 403 regardless of what the frontend does) — this
  // is only about not rendering an admin page's shell, or firing its data
  // fetches at all, for a role that can never see real data on it anyway.
  const roleAllowed = isRouteAllowedForRole(pathname, user?.role);

  useEffect(() => {
    if (!isAuthenticated) { router.push('/login'); return; }
    if (user && !roleAllowed) {
      router.replace(defaultRouteForRole(user.role));
      return;
    }
    if (user?.role === 'SUPER_ADMIN' && pathname === '/dashboard') {
      router.replace('/hospitals');
    }
    if (user?.role === 'PHARMACIST' && pathname === '/dashboard') {
      router.replace('/pharmacy');
    }
  }, [isAuthenticated, user, roleAllowed, router, pathname]);

  // Fetch hospital profile once per session — shared by billing, consultation, and pharmacy print flows
  useEffect(() => {
    if (!user?.tenantId || tenantProfile) return;
    iamApi.get(`/tenants/${user.tenantId}`)
      .then(r => setTenantProfile(r.data))
      .catch(err => console.warn('[layout] tenant profile fetch failed:', err?.message));
  }, [user?.tenantId]);

  if (!isAuthenticated || !roleAllowed) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
