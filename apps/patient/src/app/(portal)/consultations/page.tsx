"use client";
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, FileText, ChevronDown, ChevronUp, Pill, Download, MessageCircle, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import type { Consultation } from "@/types";

// ── Prescription HTML generator ───────────────────────────────────────────────

function generateRxHtml(c: Consultation, patient: { firstName: string; lastName: string | null; uhid: string; phone: string }): string {
  const meds = c.prescriptions.flatMap(rx => rx.items);
  const date = new Date(c.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  const medRows = meds.map((m, i) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">${i + 1}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;font-weight:600;">${m.medicineName}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">${m.dosage ?? '—'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">${m.frequency ?? '—'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">${m.duration ?? '—'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;font-style:italic;color:#666;">${m.instructions ?? ''}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Prescription – ${patient.firstName} ${patient.lastName ?? ''}</title>
  <style>
    @media print { body { -webkit-print-color-adjust: exact; } }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #1a1a1a; margin: 0; padding: 24px; }
    .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px; }
    .section { margin-bottom: 14px; }
    .label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #666; letter-spacing: 0.05em; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #eff6ff; text-align: left; padding: 8px; font-size: 11px; text-transform: uppercase; color: #2563eb; }
    .footer { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 11px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h2 style="margin:0;color:#2563eb;">Medical Prescription</h2>
    <p style="margin:2px 0;font-size:12px;color:#666;">Generated via Megnim Patient Portal</p>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
    <div>
      <div class="label">Patient</div>
      <p style="margin:0;font-weight:600;">${patient.firstName} ${patient.lastName ?? ''}</p>
      <p style="margin:0;font-size:12px;color:#666;">UHID: ${patient.uhid}</p>
      <p style="margin:0;font-size:12px;color:#666;">${patient.phone}</p>
    </div>
    <div>
      <div class="label">Consultation</div>
      <p style="margin:0;font-weight:600;">Dr. ${c.doctor?.firstName ?? ''} ${c.doctor?.lastName ?? ''}</p>
      <p style="margin:0;font-size:12px;color:#666;">Date: ${date}</p>
    </div>
  </div>

  ${c.diagnosis ? `
  <div class="section">
    <div class="label">Diagnosis</div>
    <p style="margin:0;">${c.diagnosis}</p>
  </div>` : ''}

  ${c.observations ? `
  <div class="section">
    <div class="label">Observations / Notes</div>
    <p style="margin:0;color:#444;">${c.observations}</p>
  </div>` : ''}

  ${meds.length > 0 ? `
  <div class="section">
    <div class="label">Prescription</div>
    <table>
      <thead>
        <tr>
          <th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Instructions</th>
        </tr>
      </thead>
      <tbody>${medRows}</tbody>
    </table>
  </div>` : ''}

  <div class="footer">
    This is a digitally generated prescription record. Please consult your physician before making any changes to your medication.
  </div>
</body>
</html>`;
}

// ── Consultation card ─────────────────────────────────────────────────────────

function ConsultationCard({ c, patient }: { c: Consultation; patient: { firstName: string; lastName: string | null; uhid: string; phone: string } }) {
  const [open, setOpen] = useState(false);
  const [printing, setPrinting] = useState(false);

  const hasMeds = c.prescriptions.some(rx => rx.items.length > 0);

  const handleDownloadRx = useCallback(() => {
    if (!hasMeds) return;
    setPrinting(true);
    try {
      const html = generateRxHtml(c, patient);
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); setPrinting(false); }, 500);
    } catch {
      setPrinting(false);
    }
  }, [c, patient, hasMeds]);

  const handleWhatsAppRx = useCallback(() => {
    if (!hasMeds) return;
    const meds = c.prescriptions.flatMap(rx => rx.items);
    const date = new Date(c.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const summary = meds.map(m => `• ${m.medicineName} — ${m.dosage ?? ''} ${m.frequency ?? ''} ${m.duration ?? ''}`).join('\n');
    const msg = encodeURIComponent(
      `My prescription from Dr. ${c.doctor?.firstName ?? ''} ${c.doctor?.lastName ?? ''} (${date}):\n\n${summary}${c.diagnosis ? `\n\nDiagnosis: ${c.diagnosis}` : ''}`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }, [c, hasMeds]);

  const handleEmailRx = useCallback(() => {
    if (!hasMeds) return;
    const meds = c.prescriptions.flatMap(rx => rx.items);
    const date = new Date(c.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const summary = meds.map(m => `${m.medicineName}: ${m.dosage ?? ''} ${m.frequency ?? ''} for ${m.duration ?? ''}`).join('\n');
    const subject = encodeURIComponent(`Prescription - Dr. ${c.doctor?.firstName ?? ''} ${c.doctor?.lastName ?? ''} - ${date}`);
    const body = encodeURIComponent(
      `Prescription from Dr. ${c.doctor?.firstName ?? ''} ${c.doctor?.lastName ?? ''} on ${date}:\n\n${summary}${c.diagnosis ? `\n\nDiagnosis: ${c.diagnosis}` : ''}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  }, [c, hasMeds]);

  return (
    <Card>
      <CardContent className="py-4 px-5">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-start justify-between gap-4 text-left"
        >
          <div className="space-y-0.5">
            <p className="font-semibold text-sm">
              Dr. {c.doctor?.firstName} {c.doctor?.lastName}
            </p>
            <p className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</p>
            {c.diagnosis && (
              <p className="text-xs text-gray-700 mt-1">Diagnosis: <span className="font-medium">{c.diagnosis}</span></p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasMeds && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                {c.prescriptions.reduce((n, rx) => n + rx.items.length, 0)} Rx
              </span>
            )}
            {c.followUps?.some((f) => !f.isCompleted) && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                Follow-up
              </span>
            )}
            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        {open && (
          <div className="mt-4 space-y-4 border-t pt-4">
            {/* Vitals */}
            {(c.bpSystolic || c.pulseRate || c.temperature) && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Vitals</p>
                <div className="flex flex-wrap gap-3">
                  {c.bpSystolic && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                      <p className="text-xs text-muted-foreground">BP</p>
                      <p className="text-sm font-semibold">{c.bpSystolic}/{c.bpDiastolic}</p>
                    </div>
                  )}
                  {c.pulseRate && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                      <p className="text-xs text-muted-foreground">Pulse</p>
                      <p className="text-sm font-semibold">{c.pulseRate} bpm</p>
                    </div>
                  )}
                  {c.temperature && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                      <p className="text-xs text-muted-foreground">Temp</p>
                      <p className="text-sm font-semibold">{c.temperature}°F</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Observations */}
            {c.observations && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Observations</p>
                <p className="text-sm text-gray-700">{c.observations}</p>
              </div>
            )}

            {/* Prescriptions */}
            {c.prescriptions?.map((rx) => (
              <div key={rx.id}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Pill className="h-3 w-3" /> Prescription
                  </p>
                  {rx.items.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleDownloadRx}
                        disabled={printing}
                        className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                      >
                        {printing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                        Download Rx
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={handleWhatsAppRx}
                        className="flex items-center gap-1 text-xs text-green-700 hover:underline"
                        title="Share via WhatsApp"
                      >
                        <MessageCircle className="h-3 w-3" /> WhatsApp
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={handleEmailRx}
                        className="flex items-center gap-1 text-xs text-blue-700 hover:underline"
                        title="Share via Email"
                      >
                        <Mail className="h-3 w-3" /> Email
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {rx.items.map((item) => (
                    <div key={item.id} className="bg-green-50 rounded-lg px-3 py-2.5">
                      <p className="text-sm font-semibold text-green-900">{item.medicineName}</p>
                      <div className="flex flex-wrap gap-2 mt-0.5">
                        {item.dosage && <span className="text-xs text-green-700">{item.dosage}</span>}
                        {item.frequency && <span className="text-xs text-green-700">• {item.frequency}</span>}
                        {item.duration && <span className="text-xs text-green-700">• {item.duration}</span>}
                      </div>
                      {item.instructions && (
                        <p className="text-xs text-green-600 mt-0.5 italic">{item.instructions}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Follow-ups */}
            {c.followUps?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Follow-ups</p>
                {c.followUps.map((f) => (
                  <div key={f.id} className={`rounded-lg px-3 py-2 flex items-center justify-between ${f.isCompleted ? "bg-gray-50" : "bg-blue-50"}`}>
                    <div>
                      <p className="text-sm font-medium">{formatDate(f.followUpDate)}</p>
                      {f.notes && <p className="text-xs text-muted-foreground">{f.notes}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.isCompleted ? "bg-gray-100 text-gray-600" : "bg-blue-100 text-blue-700"}`}>
                      {f.isCompleted ? "Done" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConsultationsPage() {
  const [page, setPage] = useState(1);
  const patient = useAuthStore((s) => s.patient);

  const { data, isLoading } = useQuery({
    queryKey: ["consultations", page],
    queryFn: () =>
      api.get<{ data: Consultation[]; totalPages: number }>(
        `/patient-portal/consultations?page=${page}&limit=10`,
      ).then((r) => r.data),
  });

  const patientInfo = {
    firstName: patient?.firstName ?? '',
    lastName: patient?.lastName ?? null,
    uhid: patient?.uhid ?? '',
    phone: patient?.phone ?? '',
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold">My Consultations</h1>
        <p className="text-sm text-muted-foreground">Medical history, diagnoses and prescriptions</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !data?.data.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No consultations found yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.data.map((c) => <ConsultationCard key={c.id} c={c} patient={patientInfo} />)}
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
