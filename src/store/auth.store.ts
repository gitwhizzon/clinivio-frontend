import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { User } from "@/types";
import { TenantProfile } from "@/lib/print";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  tenantId: string | null;
  /** Slug entered at login — used as a dev/preview fallback for X-Tenant-Slug
   *  when the hostname itself doesn't carry the tenant (see lib/tenant.ts).
   *  Not sensitive — it's visible in the URL for every real tenant anyway. */
  tenantSlug: string | null;
  /** Cached hospital profile — fetched once in DashboardLayout, used everywhere for printing */
  tenantProfile: TenantProfile | null;
  // Access/refresh tokens are httpOnly cookies now (set by the backend) —
  // never stored here, never readable by JS. setAuth only persists what the
  // UI actually needs.
  setAuth: (user: User, tenantSlug?: string) => void;
  clearAuth: () => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  setTenantProfile: (profile: TenantProfile) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      tenantId: null,
      tenantSlug: null,
      tenantProfile: null,

      setAuth: (user, tenantSlug) =>
        set({
          user,
          isAuthenticated: true,
          tenantId: user.tenantId,
          tenantSlug: tenantSlug ?? null,
        }),

      clearAuth: () =>
        set({
          user: null,
          isAuthenticated: false,
          tenantId: null,
          tenantSlug: null,
          tenantProfile: null,
        }),

      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          tenantId: null,
          tenantSlug: null,
          tenantProfile: null,
        }),

      updateUser: (partial) => {
        const current = get().user;
        if (current) {
          set({ user: { ...current, ...partial } });
        }
      },

      setTenantProfile: (profile) => set({ tenantProfile: profile }),
    }),
    {
      name: "clinivio-auth",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? localStorage
          : ({ getItem: () => null, setItem: () => {}, removeItem: () => {} } as unknown as Storage)
      ),
    }
  )
);
