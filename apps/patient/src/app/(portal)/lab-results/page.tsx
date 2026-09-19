"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, FlaskConical, AlertCircle, ChevronDown, ChevronUp, AlertTriangle, Printer, MessageCircle, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { formatDate, statusColor } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { generateLabReportHtml, printDocument } from "@/lib/print";
import type { LabOrder, LabResultFlag } from "@/types";

const flagStyle: Record<LabResultFlag, string> = {
  NORMAL:   "bg-green-100 text-green-700",
  ABNORMAL: "bg-yellow-100 text-yellow-700",
  CRITICAL: "bg-red-100 text-red-700",
};

function LabOrderCard({ order }: { order: LabOrder }) {
  const [open, setOpen] = useState(false);
  const patient = useAuthStore((s) => s.patient);
  const hasCritical = order.items.some((i) => i.flag === "CRITICAL");
  const hasAbnormal = order.items.some((i) => i.flag === "ABNORMAL");

  function handlePrint() {
    if (!patient) return;
    const html = generateLabReportHtml({
      orderNumber: order.orderNumber,
      patient: {
        firstName: patient.firstName,
        lastName: patient.lastName,
        uhid: patient.uhid,
        phone: patient.phone,
      },
      doctor: order.orderedBy
        ? { firstName: order.orderedBy.firstName, lastName: order.orderedBy.lastName }
        : null,
      priority: order.priority,
      collectedAt: order.collectedAt,
      completedAt: order.completedAt,
      clinicalNotes: order.clinicalNotes,
      items: order.items.map((i) => ({
        name: i.labTest?.name ?? "",
        result: i.result,
        unit: i.unit,
        normalRange: i.normalRange,
        flag: i.flag,
        category: i.labTest?.category,
      })),
    });
    printDocument(html);
  }

  function handleWhatsApp() {
    const completedItems = order.items.filter((i) => i.result);
    const summary = completedItems
      .map((i) => `• ${i.labTest?.name}: ${i.result} ${i.unit ?? ""} ${i.flag ? `(${i.flag})` : ""}`)
      .join("\n");
    const msg = encodeURIComponent(
      `My lab results (Order ${order.orderNumber}):\n\n${summary}${
        hasCritical ? "\n\n⚠ Critical values — contacting doctor immediately." : ""
      }`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }

  function handleEmail() {
    const completedItems = order.items.filter((i) => i.result);
    const summary = completedItems
      .map((i) => `${i.labTest?.name}: ${i.result} ${i.unit ?? ""} (${i.flag ?? "NORMAL"})`)
      .join("\n");
    const subject = encodeURIComponent(`Lab Results - Order ${order.orderNumber}`);
    const body = encodeURIComponent(
      `Lab Report (Order: ${order.orderNumber})\nPatient: ${patient?.firstName ?? ""} ${patient?.lastName ?? ""}\n\n${summary}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  }

  return (
    <Card className={hasCritical ? "border-red-200" : hasAbnormal ? "border-yellow-200" : ""}>
      <CardContent className="py-4 px-5">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-start justify-between gap-4 text-left"
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm">Order #{order.orderNumber}</p>
              {hasCritical && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
            </div>
            <p className="text-xs text-muted-foreground">
              {order.items.map((i) => i.labTest?.name).filter(Boolean).join(", ")}
            </p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
              <span>{formatDate(order.createdAt)}</span>
              {order.completedAt && <span>• Completed {formatDate(order.completedAt)}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor(order.status)}`}>
              {order.status.replace(/_/g, " ")}
            </span>
            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        {open && order.status === "COMPLETED" && order.items.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Test Results</p>
              <div className="flex gap-1.5">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50"
                  title="Print report"
                >
                  <Printer className="h-3 w-3" /> Print
                </button>
                <button
                  onClick={handleWhatsApp}
                  className="flex items-center gap-1 text-xs text-green-700 hover:text-green-900 border border-green-200 rounded-md px-2 py-1 hover:bg-green-50"
                  title="Share via WhatsApp"
                >
                  <MessageCircle className="h-3 w-3" /> WhatsApp
                </button>
                <button
                  onClick={handleEmail}
                  className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 border border-blue-200 rounded-md px-2 py-1 hover:bg-blue-50"
                  title="Share via Email"
                >
                  <Mail className="h-3 w-3" /> Email
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.labTest?.name}</p>
                    <p className="text-xs text-muted-foreground">{item.labTest?.category}</p>
                    {item.normalRange && (
                      <p className="text-xs text-muted-foreground">Normal: {item.normalRange} {item.unit ?? ""}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">
                      {item.result ?? "—"} {item.unit ?? ""}
                    </p>
                    {item.flag && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${flagStyle[item.flag]}`}>
                        {item.flag}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {order.items.some((i) => i.flag === "CRITICAL") && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 flex gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">
                  <strong>Critical values detected.</strong> Please contact your doctor immediately.
                </p>
              </div>
            )}
          </div>
        )}

        {open && order.status !== "COMPLETED" && (
          <div className="mt-4 border-t pt-4 text-center text-sm text-muted-foreground py-4">
            Results will be available once the tests are completed.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LabResultsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["lab-results", page],
    queryFn: () =>
      api.get<{ data: LabOrder[]; totalPages: number }>(
        `/patient-portal/lab-results?page=${page}&limit=10`,
      ).then((r) => r.data),
  });

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold">My Lab Results</h1>
        <p className="text-sm text-muted-foreground">View all your lab test orders and results</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : isError ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
            <p className="text-muted-foreground">Couldn&apos;t load your lab results.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      ) : !data?.data.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FlaskConical className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No lab orders found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.data.map((o) => <LabOrderCard key={o.id} order={o} />)}
          {(data?.totalPages ?? 1) > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="px-3 py-1.5 text-sm text-muted-foreground">Page {page} of {data?.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page === data?.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
