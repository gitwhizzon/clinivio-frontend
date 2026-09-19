"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, HeartPulse, MessageSquare, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toaster";
import { useAuthStore } from "@/store/auth.store";
import api from "@/lib/api";

type Mode = "password" | "otp";
type OtpStep = "phone" | "verify";

const OTP_RESEND_SECONDS = 60;

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [mode, setMode] = useState<Mode>("password");
  const [otpStep, setOtpStep] = useState<OtpStep>("phone");
  const [loading, setLoading] = useState(false);

  // Shared fields
  const [slug, setSlug] = useState("");
  const [phone, setPhone] = useState("");

  // Password mode
  const [password, setPassword] = useState("");

  // OTP mode
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startCountdown() {
    setCountdown(OTP_RESEND_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  function switchMode(m: Mode) {
    setMode(m);
    setOtpStep("phone");
    setOtp("");
    setPassword("");
    setCountdown(0);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  // ── Password login ────────────────────────────────────────────────────────────

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!slug || !phone || !password) return;
    setLoading(true);
    try {
      const res = await api.post("/patient-portal/auth/login", { slug, phone, password });
      setAuth(res.data.patient);
      toast({ title: "Welcome back!", variant: "success" });
      router.push("/dashboard");
    } catch (err: any) {
      toast({
        title: "Login failed",
        description: err?.response?.data?.message ?? "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  // ── OTP: request ──────────────────────────────────────────────────────────────

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!slug || !phone) return;
    setLoading(true);
    try {
      await api.post("/patient-portal/auth/request-otp", { slug, phone });
      setOtpStep("verify");
      startCountdown();
      toast({ title: "OTP sent", description: "Check your phone for the 6-digit code.", variant: "success" });
    } catch (err: any) {
      const msg: string = err?.response?.data?.message ?? "Failed to send OTP";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // ── OTP: verify ───────────────────────────────────────────────────────────────

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp || otp.length !== 6) return;
    setLoading(true);
    try {
      const res = await api.post("/patient-portal/auth/verify-otp", { slug, phone, otp });
      setAuth(res.data.patient);
      toast({ title: "Welcome back!", variant: "success" });
      router.push("/dashboard");
    } catch (err: any) {
      toast({
        title: "Invalid OTP",
        description: err?.response?.data?.message ?? "The code is incorrect or has expired.",
        variant: "destructive",
      });
      setOtp("");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (countdown > 0) return;
    setLoading(true);
    try {
      await api.post("/patient-portal/auth/request-otp", { slug, phone });
      startCountdown();
      setOtp("");
      toast({ title: "OTP resent", description: "A new code has been sent.", variant: "success" });
    } catch (err: any) {
      toast({ title: "Error", description: err?.response?.data?.message ?? "Failed to resend OTP", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <HeartPulse className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your health portal</CardDescription>
        </CardHeader>

        <CardContent>
          {/* Mode toggle */}
          <div className="flex rounded-lg border p-1 mb-5 bg-muted/40">
            <button
              type="button"
              onClick={() => switchMode("password")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors ${
                mode === "password"
                  ? "bg-white shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Lock className="h-3.5 w-3.5" />
              Password
            </button>
            <button
              type="button"
              onClick={() => switchMode("otp")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors ${
                mode === "otp"
                  ? "bg-white shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              OTP / SMS
            </button>
          </div>

          {/* ── Password mode ── */}
          {mode === "password" && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Hospital ID</label>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="e.g. city-hospital"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone Number</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="••••••••"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !slug || !phone || !password}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
          )}

          {/* ── OTP mode: phone step ── */}
          {mode === "otp" && otpStep === "phone" && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Hospital ID</label>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="e.g. city-hospital"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone Number</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !slug || !phone}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send OTP
              </Button>
            </form>
          )}

          {/* ── OTP mode: verify step ── */}
          {mode === "otp" && otpStep === "verify" && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center text-sm text-muted-foreground pb-1">
                Code sent to <span className="font-medium text-foreground">{phone}</span>
                <button
                  type="button"
                  onClick={() => { setOtpStep("phone"); setOtp(""); }}
                  className="ml-2 text-primary hover:underline text-xs"
                >
                  Change
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-center">Enter 6-digit OTP</label>
                <input
                  value={otp}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setOtp(v);
                  }}
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                  className="w-full rounded-md border px-3 py-3 text-center text-xl font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || otp.length !== 6}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify & Sign in
              </Button>

              <div className="text-center text-sm">
                {countdown > 0 ? (
                  <span className="text-muted-foreground">
                    Resend in <span className="font-medium tabular-nums">{countdown}s</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={loading}
                    className="text-primary hover:underline disabled:opacity-50"
                  >
                    Resend OTP
                  </button>
                )}
              </div>
            </form>
          )}

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary font-medium hover:underline">
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
