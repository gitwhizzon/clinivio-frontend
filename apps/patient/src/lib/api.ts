import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";

// The access token is an httpOnly cookie (patientAccessToken) now — this
// only needs the (non-sensitive) tenantId for the pre-login discovery routes.
function getTenantId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("clinivio-patient-auth");
    if (!raw) return null;
    return JSON.parse(raw)?.state?.tenantId ?? null;
  } catch {
    return null;
  }
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://api.megnim.com";

function createApi(): AxiosInstance {
  const instance = axios.create({
    baseURL: API_BASE,
    timeout: 15_000,
    withCredentials: true, // send/receive the httpOnly patientAccessToken cookie
    headers: { "Content-Type": "application/json" },
  });

  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const tenantId = getTenantId();
    if (tenantId && config.headers && !config.url?.startsWith("/patient-portal/auth/")) {
      config.headers["X-Tenant-Id"] = tenantId;
    }
    return config;
  });

  instance.interceptors.response.use(
    (r) => r,
    (error: AxiosError) => {
      if (error.response?.status === 401 && typeof window !== "undefined") {
        localStorage.removeItem("clinivio-patient-auth");
        window.location.href = "/login";
      }
      return Promise.reject(error);
    },
  );

  return instance;
}

export const api = createApi();
export default api;
