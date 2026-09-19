import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/auth.store";

// ─── LocalStorage helpers (client-side only) ─────────────────────────────────

function getAuthState(): { token: string | null; refreshToken: string | null; tenantSlug: string | null } {
  if (typeof window === "undefined") return { token: null, refreshToken: null, tenantSlug: null };
  try {
    const raw = localStorage.getItem("clinivio-auth");
    if (!raw) return { token: null, refreshToken: null, tenantSlug: null };
    const parsed = JSON.parse(raw);
    return {
      token:        parsed?.state?.token        ?? null,
      refreshToken: parsed?.state?.refreshToken ?? null,
      tenantSlug:   parsed?.state?.tenantSlug    ?? null,
    };
  } catch {
    return { token: null, refreshToken: null, tenantSlug: null };
  }
}

function redirectToLogin() {
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

// ─── Silent access-token refresh ─────────────────────────────────────────────
// Refresh tokens now rotate server-side (one-time use) — the old token is
// deleted the moment it's redeemed, so every 401 must go through this single
// shared refresh call (never a plain read of the stored token) or concurrent
// requests would race to redeem the same refresh token and half of them
// would fail. The successful caller updates the store with the NEW rotated
// pair so the next refresh has a token to redeem too.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const { refreshToken } = getAuthState();
    if (!refreshToken) return null;
    try {
      const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
      const store = useAuthStore.getState();
      if (store.user) {
        store.setAuth(store.user, data.accessToken, data.refreshToken, store.tenantSlug ?? undefined);
      }
      return data.accessToken as string;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

function createApiInstance(baseURL: string): AxiosInstance {
  const instance = axios.create({
    baseURL,
    timeout: 15_000,
    headers: { "Content-Type": "application/json" },
  });

  // Request interceptor — attach Bearer token + X-Tenant-Slug
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const { token, tenantSlug } = getAuthState();

      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Send the tenant slug on every request so TenantContextMiddleware can
      // set the correct DataSource even when no subdomain is present
      // (e.g. direct Render/Vercel URLs).
      // Skip auth endpoints — login uses slug in the request body, not header.
      const isAuthEndpoint = config.url?.startsWith("/auth/");
      if (tenantSlug && config.headers && !isAuthEndpoint) {
        config.headers["X-Tenant-Slug"] = tenantSlug;
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor — try one silent refresh on 401, else clear auth
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const original = error.config as
        | (InternalAxiosRequestConfig & { _retriedAfterRefresh?: boolean })
        | undefined;
      const isAuthEndpoint = original?.url?.startsWith("/auth/");

      if (
        error.response?.status === 401 &&
        original &&
        !original._retriedAfterRefresh &&
        !isAuthEndpoint
      ) {
        original._retriedAfterRefresh = true;
        const newAccessToken = await refreshAccessToken();
        if (newAccessToken) {
          original.headers = original.headers ?? ({} as any);
          (original.headers as any).Authorization = `Bearer ${newAccessToken}`;
          return instance(original);
        }
      }

      if (error.response?.status === 401) {
        if (typeof window !== "undefined") {
          useAuthStore.getState().clearAuth();
          redirectToLogin();
        }
      }
      return Promise.reject(error);
    }
  );

  return instance;
}

// ─── Single unified API base URL ──────────────────────────────────────────────

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://api.megnim.com";

// All four instances point to the same backend.
export const iamApi         = createApiInstance(API_BASE);
export const patientApi     = createApiInstance(API_BASE);
export const appointmentApi = createApiInstance(API_BASE);
export const billingApi     = createApiInstance(API_BASE);

export default iamApi;
