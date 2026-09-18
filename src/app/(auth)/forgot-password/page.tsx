"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Activity, AlertCircle, CheckCircle2, Building2, Mail } from "lucide-react";
import { iamApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { resolveHostContext, HostContext } from "@/lib/tenant";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  slug: z
    .string()
    .min(1, "Hospital ID is required")
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Only lowercase letters, numbers and hyphens"),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      slug: searchParams.get("slug") ?? "",
    },
  });

  // Tenant slug comes from the subdomain when there is one (hansvl.megnim.com
  // → "hansvl"); the manual field below only shows up when there's no real
  // subdomain to read (localhost, a Vercel/Render preview URL, or the
  // platform host itself, which has no forgot-password flow of its own).
  const [hostContext, setHostContext] = useState<HostContext>({ kind: "unknown" });
  useEffect(() => {
    const ctx = resolveHostContext();
    setHostContext(ctx);
    if (ctx.kind === "tenant") setValue("slug", ctx.slug, { shouldValidate: true });
  }, [setValue]);

  const isTenantHost = hostContext.kind === "tenant";

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      await iamApi.post("/auth/forgot-password", values);
      setSent(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setServerError(e?.response?.data?.message ?? "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-blue-900 to-blue-800 flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-5 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 opacity-80" />
              <span className="font-bold text-sm tracking-wide">Megnim</span>
            </div>
            <p className="text-white font-semibold text-base">Reset Password</p>
            <p className="text-blue-200 text-xs mt-0.5">We&apos;ll email you a secure reset link</p>
          </div>

          <div className="p-6">
            {sent ? (
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                  </div>
                </div>
                <div>
                  <p className="text-gray-900 font-semibold text-base">Check your inbox</p>
                  <p className="text-gray-500 text-sm mt-1 leading-relaxed">
                    If that email is registered, you&apos;ll receive a reset link shortly.
                    The link expires in 1 hour.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="block text-center text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Back to Sign In
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {serverError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{serverError}</span>
                  </div>
                )}

                {/* Hospital ID — auto-detected from the subdomain on a real
                    tenant host; manual entry is a dev/QA fallback only. */}
                {isTenantHost ? (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    Resetting password for <span className="font-mono font-medium text-gray-700">{hostContext.kind === "tenant" ? hostContext.slug : ""}</span>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hospital ID
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                      <input
                        {...register("slug")}
                        type="text"
                        placeholder="e.g. citihospital"
                        autoComplete="organization"
                        className={cn(
                          "w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm bg-white transition-colors font-mono",
                          "placeholder:text-gray-300 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                          errors.slug ? "border-red-400 bg-red-50" : "border-gray-300 hover:border-gray-400"
                        )}
                      />
                    </div>
                    {errors.slug && (
                      <p className="text-xs text-red-600 mt-1">{errors.slug.message}</p>
                    )}
                  </div>
                )}

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                    <input
                      {...register("email")}
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      className={cn(
                        "w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm bg-white transition-colors",
                        "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                        errors.email ? "border-red-400 bg-red-50" : "border-gray-300 hover:border-gray-400"
                      )}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </button>

                <p className="text-center">
                  <Link
                    href="/login"
                    className="text-xs text-gray-500 hover:text-indigo-600 transition-colors"
                  >
                    Back to Sign In
                  </Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
