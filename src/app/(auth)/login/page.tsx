"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Eye, EyeOff, Activity, AlertCircle, Building2,
} from "lucide-react";
import { iamApi, API_BASE } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { AuthResponse } from "@/types";
import { cn } from "@/lib/utils";
import { resolveHostContext, HostContext } from "@/lib/tenant";

// ─── Schema ───────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  identifier: z.string().min(1, "Staff ID or Email is required"),
  password:   z.string().min(6, "Password must be at least 6 characters"),
  // Hospital slug — leave blank to log in as Platform Admin (SUPER_ADMIN)
  slug: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^$/, "Only lowercase letters, numbers and hyphens")
    .optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface HospitalProfile {
  name: string;
  tagline: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
}

// ─── Role → destination map ───────────────────────────────────────────────────

const ROLE_DEST: Record<string, string> = {
  SUPER_ADMIN:    "/hospitals",
  LAB_TECHNICIAN: "/lab",
  PHARMACIST:     "/pharmacy",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router  = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [showPassword, setShowPassword] = useState(false);
  const [serverError,  setServerError]  = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "", slug: "" },
  });

  const slugValue = watch("slug") ?? "";

  // The tenant slug is read from the subdomain (hansvl.megnim.com → "hansvl"),
  // not typed in. The manual field below only appears as a dev/QA fallback on
  // hosts with no real subdomain to read (localhost, Vercel/Render previews).
  const [hostContext, setHostContext] = useState<HostContext>({ kind: "unknown" });
  useEffect(() => {
    setHostContext(resolveHostContext());
  }, []);

  // Real hospital branding for the left panel — falls back to the generic
  // Megnim copy below if this hasn't loaded yet or the tenant left fields blank.
  const [hospital, setHospital] = useState<HospitalProfile | null>(null);
  // Any subdomain resolves DNS/TLS now that *.megnim.com is wildcarded — a
  // made-up slug (e.g. hospitalx.megnim.com) must not render a working-looking
  // login form. A 404 here means the slug isn't a real, active tenant at all
  // (distinct from a real tenant that just hasn't filled in branding yet).
  const [tenantNotFound, setTenantNotFound] = useState(false);
  // Fail closed: starts true so the interactive form never paints — not even
  // for one frame — before we know this subdomain is a real tenant. Only
  // "tenant" hosts have anything to check; platform/unknown hosts clear this
  // immediately since there's no slug to validate.
  const [checkingTenant, setCheckingTenant] = useState(true);
  useEffect(() => {
    if (hostContext.kind === "unknown") return; // still resolving the host itself
    if (hostContext.kind !== "tenant") {
      setCheckingTenant(false);
      return;
    }
    iamApi
      .get<HospitalProfile>("/patient-portal/public/hospital-profile")
      .then(({ data }) => setHospital(data))
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) setTenantNotFound(true);
        // Any other error (network blip, etc.) — generic branding is a fine
        // fallback for those, this isn't a load-bearing failure on its own.
      })
      .finally(() => setCheckingTenant(false));
  }, [hostContext]);

  // Reads ?error=sso_failed off the SSO callback's redirect (avoids
  // useSearchParams' Suspense-boundary requirement for something this simple).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "sso_failed") {
      setServerError(
        "Microsoft sign-in failed. Your account may not be registered as a platform admin, or you signed in with the wrong organization account.",
      );
      params.delete("error");
      const query = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : ""));
    }
  }, []);

  const isUnknownHost = hostContext.kind === "unknown";
  const isHospitalLogin =
    hostContext.kind === "tenant" || (isUnknownHost && slugValue.trim().length > 0);
  const effectiveSlug =
    hostContext.kind === "tenant"
      ? hostContext.slug
      : isUnknownHost
        ? slugValue.trim() || undefined
        : undefined;
  // What the header badge shows — the detected slug on a real tenant host,
  // otherwise whatever's been typed into the dev-fallback field.
  const displaySlug = hostContext.kind === "tenant" ? hostContext.slug : slugValue;

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    try {
      const payload: Record<string, string> = {
        identifier: values.identifier,
        password:   values.password,
      };
      if (effectiveSlug) payload.slug = effectiveSlug;

      const { data } = await iamApi.post<AuthResponse>("/auth/login", payload);
      // accessToken/refreshToken arrive as httpOnly cookies now — only the
      // slug is stored, as a dev/preview fallback for hosts with no real
      // subdomain (lib/api.ts prefers deriving it fresh from the hostname).
      setAuth(data.user, effectiveSlug);
      router.replace(ROLE_DEST[data.user.role] ?? "/dashboard");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(
        error?.response?.data?.message ?? "Invalid credentials. Please try again."
      );
    }
  }

  // Still confirming this subdomain is a real tenant — show a neutral
  // spinner, not the interactive form. Without this gate the form would
  // paint immediately (tenantNotFound starts false) and only swap to the
  // "not found" state after the profile check resolves, letting a made-up
  // hospital's login form flash on screen for a moment on every load.
  if (checkingTenant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-blue-900 to-blue-800 flex items-center justify-center p-6">
        <span className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  // A subdomain that isn't a real, active tenant — block outright rather than
  // rendering a login form that would make a made-up hospital look real.
  if (tenantNotFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-blue-900 to-blue-800 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-sm w-full">
          <div className="px-6 py-5 bg-gradient-to-r from-slate-700 to-slate-800 text-white">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 opacity-80" />
              <span className="font-bold text-sm tracking-wide">Megnim</span>
            </div>
          </div>
          <div className="p-6 space-y-3 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <p className="text-gray-900 font-semibold">Hospital not found</p>
            <p className="text-sm text-gray-500">
              <span className="font-mono">{displaySlug}</span> isn&apos;t a registered
              hospital on Megnim. Check the link your administrator gave you, or
              contact them if you believe this is a mistake.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-blue-900 to-blue-800 flex items-center justify-center p-6">

      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-4xl flex flex-col lg:flex-row gap-8 items-center">

        {/* ── Left: Branding ─────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 lg:pr-4">

          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center ring-2 ring-white/20">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white font-extrabold text-2xl tracking-tight leading-none">Megnim</p>
              <p className="text-blue-300 text-sm mt-0.5">by Whizzon.ai · Hospital Management</p>
            </div>
          </div>

          {/* Tagline — the hospital's own branding on a tenant subdomain, once
              /patient-portal/public/hospital-profile resolves; generic Megnim
              marketing copy everywhere else (or while it's still loading). */}
          {hospital ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                {hospital.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={hospital.logoUrl}
                    alt={hospital.name}
                    className="w-10 h-10 rounded-xl object-cover ring-2 ring-white/20 bg-white/10"
                  />
                )}
                <h1 className="text-white text-3xl font-bold leading-tight">
                  {hospital.name}
                </h1>
              </div>
              <p className="text-blue-200 text-base leading-relaxed mb-2 max-w-sm">
                {hospital.tagline ?? "Managed on the Megnim hospital platform."}
              </p>
              {(hospital.city || hospital.state) && (
                <p className="text-blue-300/80 text-sm mb-1">
                  {[hospital.city, hospital.state].filter(Boolean).join(", ")}
                </p>
              )}
              {(hospital.phone || hospital.email) && (
                <p className="text-blue-300/80 text-sm mb-8">
                  {[hospital.phone, hospital.email].filter(Boolean).join(" · ")}
                </p>
              )}
              {!hospital.phone && !hospital.email && <div className="mb-8" />}
            </>
          ) : (
            <>
              <h1 className="text-white text-3xl font-bold leading-tight mb-3">
                Your Hospital.<br />Fully Managed.
              </h1>
              <p className="text-blue-200 text-base leading-relaxed mb-8 max-w-sm">
                A complete platform for managing patients, doctors, pharmacy,
                billing, and more — purpose-built for modern hospitals.
              </p>
            </>
          )}

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {[
              '🏥 Multi-tenant',
              '📋 Appointments',
              '💊 Pharmacy',
              '🧪 Lab',
              '💰 Billing',
              '📱 WhatsApp alerts',
            ].map(f => (
              <span key={f}
                className="text-xs px-3 py-1.5 bg-white/10 backdrop-blur text-blue-100 rounded-full border border-white/10">
                {f}
              </span>
            ))}
          </div>

          {/* Login guidance — adapts to what this hostname resolved to */}
          <div className="mt-8 space-y-2">
            {hostContext.kind === "tenant" && (
              <div className="px-4 py-3 bg-white/5 rounded-xl border border-white/10">
                <p className="text-blue-200 text-xs font-semibold mb-1">
                  Signing in to <span className="font-mono">{hostContext.slug}</span>
                </p>
                <p className="text-blue-300/70 text-xs">Sign in with your Staff ID (e.g. <span className="font-mono">DOC0001</span>) or email. Wrong hospital? Ask your administrator for the correct sign-in link.</p>
              </div>
            )}
            {hostContext.kind === "platform" && (
              <div className="px-4 py-3 bg-white/5 rounded-xl border border-white/10">
                <p className="text-blue-200 text-xs font-semibold mb-1">Platform Admin</p>
                <p className="text-blue-300/70 text-xs">Sign in with your Microsoft work account.</p>
              </div>
            )}
            {isUnknownHost && (
              <>
                <div className="px-4 py-3 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-blue-200 text-xs font-semibold mb-1">Platform Admin</p>
                  <p className="text-blue-300/70 text-xs">Leave Hospital ID blank and sign in with your platform credentials.</p>
                </div>
                <div className="px-4 py-3 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-blue-200 text-xs font-semibold mb-1">Hospital Staff (Admin / Doctor / Nurse…)</p>
                  <p className="text-blue-300/70 text-xs">Enter your Hospital ID (e.g. <span className="font-mono">citihospital</span>) then sign in with your Staff ID (e.g. <span className="font-mono">DOC0001</span>) or email.</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Right: Login form ───────────────────────────────────────────── */}
        <div className="w-full lg:w-[360px] flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

            {/* Dynamic header — changes based on whether slug is filled */}
            <div className={cn(
              "px-6 py-5 text-white transition-all",
              isHospitalLogin
                ? "bg-gradient-to-r from-violet-600 to-indigo-600"
                : "bg-gradient-to-r from-indigo-600 to-blue-600"
            )}>
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 opacity-80" />
                <span className="font-bold text-sm tracking-wide">Megnim</span>
              </div>
              {isHospitalLogin ? (
                <>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Building2 className="w-3.5 h-3.5 opacity-70" />
                    <p className="text-violet-100 text-xs font-mono font-medium">{displaySlug}</p>
                  </div>
                  <p className="text-white font-semibold text-base">
                    {hospital?.name ?? "Hospital Sign In"}
                  </p>
                  <p className="text-violet-200 text-xs mt-0.5">Sign in with your staff credentials</p>
                </>
              ) : (
                <>
                  <p className="text-white font-semibold text-base">Sign in to Megnim</p>
                  <p className="text-blue-200 text-xs mt-0.5">Platform Admin · Hospital Staff</p>
                </>
              )}
            </div>

            <div className="p-6 space-y-4">

              {serverError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{serverError}</span>
                </div>
              )}

              {/* Platform admin accounts that have linked Microsoft SSO can no
                  longer use password login at all (enforced server-side too,
                  in AuthService.validateUser — this isn't just a UI hide).
                  The password form only makes sense for hospital staff and
                  the unknown-host dev/QA fallback. */}
              {hostContext.kind !== "platform" && (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

                {/* Hospital ID (slug) — dev/QA fallback only. On a real tenant
                    or platform host the slug comes from the subdomain instead. */}
                {isUnknownHost && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hospital ID
                      <span className="ml-1.5 text-xs font-normal text-gray-400">(leave blank for Platform Admin)</span>
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                      <input
                        {...register("slug")}
                        type="text"
                        autoComplete="organization"
                        placeholder="e.g. citihospital"
                        className={cn(
                          "w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm bg-white transition-colors font-mono",
                          "placeholder:text-gray-300 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                          errors.slug
                            ? "border-red-400 bg-red-50"
                            : "border-gray-300 hover:border-gray-400"
                        )}
                      />
                    </div>
                    {errors.slug && (
                      <p className="text-xs text-red-600 mt-1">{errors.slug.message}</p>
                    )}
                  </div>
                )}

                {/* Staff ID or Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Staff ID or Email
                  </label>
                  <input
                    {...register("identifier")}
                    type="text"
                    autoComplete="username"
                    placeholder="DOC0001 or you@example.com"
                    className={cn(
                      "w-full px-3 py-2.5 rounded-lg border text-sm bg-white transition-colors",
                      "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                      errors.identifier
                        ? "border-red-400 bg-red-50"
                        : "border-gray-300 hover:border-gray-400"
                    )}
                  />
                  {errors.identifier && (
                    <p className="text-xs text-red-600 mt-1">{errors.identifier.message}</p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      {...register("password")}
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className={cn(
                        "w-full px-3 py-2.5 pr-10 rounded-lg border text-sm bg-white transition-colors",
                        "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                        errors.password
                          ? "border-red-400 bg-red-50"
                          : "border-gray-300 hover:border-gray-400"
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={cn(
                    "w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-all",
                    "focus:outline-none focus:ring-2 focus:ring-offset-2",
                    "disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2",
                    isHospitalLogin
                      ? "bg-violet-600 hover:bg-violet-700 focus:ring-violet-500"
                      : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    "Sign In"
                  )}
                </button>

                {isHospitalLogin && (
                  <p className="text-center">
                    <a
                      href={`/forgot-password${effectiveSlug ? `?slug=${encodeURIComponent(effectiveSlug)}` : ''}`}
                      className="text-xs text-gray-500 hover:text-violet-600 transition-colors"
                    >
                      Forgot your password?
                    </a>
                  </p>
                )}
              </form>
              )}

              {hostContext.kind === "platform" && (
                <>
                  {/* Plain navigation, not a fetch — the whole SSO flow is
                      server-driven redirects (see auth.controller.ts). */}
                  <a
                    href={`${API_BASE}/auth/sso/microsoft`}
                    className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                    </svg>
                    Sign in with Microsoft
                  </a>
                </>
              )}

              <p className="text-center text-xs text-gray-400 pt-1">
                Secured by Megnim · All activity is logged
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
