import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/auth.store";
import { resolveHostContext } from "@/lib/tenant";

// ─── Tenant slug ──────────────────────────────────────────────────────────────
// Prefer the current hostname (hansvl.megnim.com -> "hansvl") over whatever
// was stored at login — it's always fresh and can't go stale/tampered like a
// persisted value could. Only falls back to the stored slug on hosts with no
// real subdomain to read (localhost, Vercel/Render preview URLs) — see
// lib/tenant.ts and the login page's dev-fallback field.
function getTenantSlug(): string | null {
  const hostContext = resolveHostContext();
  if (hostContext.kind === "tenant") return hostContext.slug;
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("clinivio-auth");
    if (!raw) return null;
    return JSON.parse(raw)?.state?.tenantSlug ?? null;
  } catch {
    return null;
  }
}

function redirectToLogin() {
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

// ─── Silent access-token refresh ─────────────────────────────────────────────
// Access/refresh tokens are httpOnly cookies now (backend sets them via
// Set-Cookie) — this client never reads or stores them. Refresh tokens
// rotate server-side (one-time use), so every 401 must go through this
// single shared refresh call rather than each failed request refreshing
// independently, or concurrent requests would race to redeem the same
// one-time refresh cookie and half of them would fail.
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      await iamApi.post("/auth/refresh");
      return true;
    } catch {
      return false;
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
    withCredentials: true, // send/receive the httpOnly auth cookies
    headers: { "Content-Type": "application/json" },
  });

  // Request interceptor — attach X-Tenant-Slug (auth itself rides the cookie jar)
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const tenantSlug = getTenantSlug();
      // Skip auth endpoints — login sends slug in the request body, not a header.
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
        if (await refreshAccessToken()) {
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
