"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Calendar, FlaskConical, FileText, CreditCard,
  ChevronRight, Clock, CheckCircle2, AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth.store";
import api from "@/lib/api";
import { formatDate, formatCurrency, statusColor } from "@/lib/utils";
import type { Appointment, LabOrder, Invoice } from "@/types";

export default function DashboardPage() {
  const patient = useAuthStore((s) => s.patient);

  const {
    data: appts,
    isError: apptsError,
    refetch: refetchAppts,
  } = useQuery({
    queryKey: ["appointments"],
    queryFn: () => api.get<{ data: Appointment[] }>("/patient-portal/appointments?limit=3").then((r) => r.data.data),
  });

  const {
    data: labs,
    isError: labsError,
    refetch: refetchLabs,
  } = useQuery({
    queryKey: ["lab-results"],
    queryFn: () => api.get<{ data: LabOrder[] }>("/patient-portal/lab-results?limit=3").then((r) => r.data.data),
  });

  const {
    data: invoices,
    isError: invoicesError,
    refetch: refetchInvoices,
  } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => api.get<{ data: Invoice[] }>("/patient-portal/invoices?limit=3").then((r) => r.data.data),
  });

  const pendingInvoices = invoices?.filter((i) => i.paymentStatus === "PENDING") ?? [];
  const upcomingAppts = appts?.filter((a) => a.status !== "CANCELLED" && a.status !== "COMPLETED") ?? [];
  const completedLabs = labs?.filter((l) => l.status === "COMPLETED") ?? [];
  const hasLoadError = apptsError || labsError || invoicesError;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Hello, {patient?.firstName} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Here&apos;s an overview of your health records.</p>
      </div>

      {hasLoadError && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <span>Some of your records couldn&apos;t be loaded — the summary below may be incomplete.</span>
          <button
            onClick={() => { refetchAppts(); refetchLabs(); refetchInvoices(); }}
            className="font-medium underline hover:no-underline whitespace-nowrap ml-3"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/appointments">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{upcomingAppts.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Upcoming Appointments</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/lab-results">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <FlaskConical className="h-5 w-5 text-purple-500" />
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{completedLabs.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Lab Results Ready</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/consultations">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <FileText className="h-5 w-5 text-green-500" />
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{appts?.filter((a) => a.status === "COMPLETED").length ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Consultations</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/invoices">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <CreditCard className="h-5 w-5 text-orange-500" />
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{pendingInvoices.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pending Bills</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Appointments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Appointments</CardTitle>
            <Link href="/appointments" className="text-xs text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {apptsError ? (
              <p className="text-sm text-red-600 py-4 text-center">Couldn&apos;t load appointments</p>
            ) : !appts || appts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No appointments yet</p>
            ) : (
              appts.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-3 py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    {a.status === "COMPLETED" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    ) : a.status === "CANCELLED" ? (
                      <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    ) : (
                      <Clock className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        Dr. {a.doctor?.firstName} {a.doctor?.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(a.scheduledAt ?? a.createdAt)}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(a.status)}`}>
                    {a.status.replace(/_/g, " ")}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Lab Results */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Lab Results</CardTitle>
            <Link href="/lab-results" className="text-xs text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {labsError ? (
              <p className="text-sm text-red-600 py-4 text-center">Couldn&apos;t load lab results</p>
            ) : !labs || labs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No lab results yet</p>
            ) : (
              labs.map((l) => (
                <div key={l.id} className="flex items-start justify-between gap-3 py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">Order #{l.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.items.map((i) => i.labTest?.name).filter(Boolean).join(", ") || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(l.createdAt)}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(l.status)}`}>
                    {l.status.replace(/_/g, " ")}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Pending Bills */}
        {pendingInvoices.length > 0 && (
          <Card className="lg:col-span-2 border-orange-200 bg-orange-50/40">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base text-orange-800">Pending Bills</CardTitle>
              <Link href="/invoices" className="text-xs text-primary hover:underline">View all</Link>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {pendingInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between py-2 border-b border-orange-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium">Invoice #{inv.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(inv.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-orange-700">{formatCurrency(Number(inv.totalAmount))}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(inv.paymentStatus)}`}>
                        {inv.paymentStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
