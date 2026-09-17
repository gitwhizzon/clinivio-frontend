import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";

// ─── LocalStorage helpers (client-side only) ─────────────────────────────────

function getAuthState(): { token: string | null; tenantSlug: string | null } {
  if (typeof window === "undefined") return { token: null, tenantSlug: null };
  try {
    const raw = localStorage.getItem("clinivio-auth");
    if (!raw) return { token: null, tenantSlug: null };
    const parsed = JSON.parse(raw);
    return {
      token:      parsed?.state?.token      ?? null,
      tenantSlug: parsed?.state?.tenantSlug ?? null,
    };
  } catch {
    return { token: null, tenantSlug: null };
  }
}

function redirectToLogin() {
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
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

  // Response interceptor — handle 401 globally
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      if (error.response?.status === 401) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("clinivio-auth");
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
  process.env.NEXT_PUBLIC_API_URL || "https://clinivio-backend.onrender.com";

// All four instances point to the same backend.
export const iamApi         = createApiInstance(API_BASE);
export const patientApi     = createApiInstance(API_BASE);
export const appointmentApi = createApiInstance(API_BASE);
export const billingApi     = createApiInstance(API_BASE);

export default iamApi;
