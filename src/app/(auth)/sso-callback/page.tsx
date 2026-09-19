"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, AlertCircle } from "lucide-react";
import { iamApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { AuthResponse } from "@/types";

const ROLE_DEST: Record<string, string> = {
  SUPER_ADMIN: "/hospitals",
};

// Landing page for the Microsoft SSO redirect (auth.controller.ts's
// ssoMicrosoftCallback). The URL carries a short-lived, single-use opaque
// code — never the JWT itself — which gets exchanged here via a POST so the
// real tokens never appear in a URL or browser history.
export default function SsoCallbackPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) {
      setError("Missing SSO code — please try signing in again.");
      return;
    }

    iamApi
      .post<AuthResponse>("/auth/sso/exchange", { code })
      .then(({ data }) => {
        setAuth(data.user);
        router.replace(ROLE_DEST[data.user.role] ?? "/hospitals");
      })
      .catch(() => {
        setError("This sign-in link has expired or was already used. Please try again.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-blue-900 to-slate-900 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          <span className="font-bold text-gray-900">Megnim</span>
        </div>
        {error ? (
          <>
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5 text-left">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
            <a href="/login" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Back to sign in
            </a>
          </>
        ) : (
          <>
            <span className="w-6 h-6 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin inline-block" />
            <p className="text-sm text-gray-500">Signing you in…</p>
          </>
        )}
      </div>
    </div>
  );
}
