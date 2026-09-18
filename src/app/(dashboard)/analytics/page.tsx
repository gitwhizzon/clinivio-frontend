'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { appointmentApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';

interface ConditionStat { condition: string; count: number; percentage: number; }
interface MedicineStat  { medicine: string; count: number; }
interface VitalTrends   {
  condition: string; patientCount: number; consultationCount: number;
  averageVitals: { bpSystolic?: number | null; bpDiastolic?: number | null; pulseRate?: number | null; spo2?: number | null; rbsMgDl?: number | null; bmi?: number | null };
}
interface DoctorStats { totalConsultations: number; totalPrescriptions: number; uniquePatients: number; }
interface LabSummary {
  totalOrders: number; completedOrders: number; completionRate: number;
  abnormalCount: number; abnormalRate: number;
  topTests: { test: string; count: number }[];
  dailyVolume: { date: string; count: number }[];
}

const PALETTE = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#84cc16','#ec4899','#6366f1',
];

const PERIODS = [
  { label: '30 days', value: '30' },
  { label: '90 days', value: '90' },
  { label: '6 months', value: '180' },
  { label: '1 year', value: '365' },
];

function Spinner() {
  return <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;
}

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [
    headers.join(','),
    ...rows.map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export default function AnalyticsPage() {
  const { user } = useAuthStore();
  const isDoctor = user?.role === 'DOCTOR';

  // ── Scope / filter state ───────────────────────────────────────────────────
  const [mineOnly, setMineOnly]           = useState(false);
  const [period, setPeriod]               = useState('90');
  const [showExport, setShowExport]       = useState(false);
  const exportRef                         = useRef<HTMLDivElement>(null);

  // ── Data state ─────────────────────────────────────────────────────────────
  const [conditionData, setConditionData] = useState<{ totalPatients: number; patientsTagged: number; distribution: ConditionStat[] } | null>(null);
  const [medicineData, setMedicineData]   = useState<{ condition: string; patientCount: number; medicines: MedicineStat[] } | null>(null);
  const [vitalData, setVitalData]         = useState<VitalTrends | null>(null);
  const [aiInsights, setAiInsights]       = useState<string | null>(null);
  const [aiLoading, setAiLoading]         = useState(false);
  const [doctorStats, setDoctorStats]     = useState<DoctorStats | null>(null);
  const [selectedCondition, setSelectedCondition] = useState('');
  const [loadingConditions, setLoadingConditions] = useState(true);
  const [loadingMeds, setLoadingMeds]     = useState(false);
  const [loadingVitals, setLoadingVitals] = useState(false);
  const [chartType, setChartType]         = useState<'bar' | 'pie'>('bar');
  const [ageData, setAgeData]             = useState<{ ageGroup: string; count: number; percentage: number }[] | null>(null);
  const [loadingAge, setLoadingAge]       = useState(true);
  const [labData, setLabData]             = useState<LabSummary | null>(null);
  const [loadingLab, setLoadingLab]       = useState(true);

  const mineParam = mineOnly ? '&mine=true' : '';

  // ── Fetches ────────────────────────────────────────────────────────────────
  const loadConditions = useCallback(() => {
    setLoadingConditions(true);
    setConditionData(null);
    setSelectedCondition('');
    setMedicineData(null);
    setVitalData(null);
    appointmentApi.get(`/analytics/conditions?v=1${mineParam}`)
      .then(r => setConditionData(r.data))
      .catch(() => {})
      .finally(() => setLoadingConditions(false));
  }, [mineParam]);

  useEffect(() => { loadConditions(); }, [loadConditions]);

  useEffect(() => {
    setLoadingAge(true);
    appointmentApi.get(`/analytics/age-distribution?v=1${mineParam}`)
      .then(r => setAgeData(r.data?.distribution ?? []))
      .catch(() => setAgeData([]))
      .finally(() => setLoadingAge(false));
  }, [mineParam]);

  useEffect(() => {
    setLoadingLab(true);
    appointmentApi.get(`/analytics/lab-summary?days=${period}${mineParam}`)
      .then(r => setLabData(r.data))
      .catch(() => setLabData(null))
      .finally(() => setLoadingLab(false));
  }, [mineParam, period]);

  useEffect(() => {
    if (!isDoctor) return;
    appointmentApi.get('/analytics/my-stats')
      .then(r => setDoctorStats(r.data))
      .catch(() => {});
  }, [isDoctor]);

  const loadMedicinePatterns = useCallback((condition: string) => {
    setLoadingMeds(true);
    const q = condition ? `&condition=${encodeURIComponent(condition)}` : '';
    appointmentApi.get(`/analytics/medicine-patterns?v=1${q}${mineParam}`)
      .then(r => setMedicineData(r.data))
      .catch(() => {})
      .finally(() => setLoadingMeds(false));
  }, [mineParam]);

  const loadVitalTrends = useCallback((condition: string) => {
    if (!condition) return;
    setLoadingVitals(true);
    appointmentApi.get(`/analytics/vital-trends?condition=${encodeURIComponent(condition)}${mineParam}`)
      .then(r => setVitalData(r.data))
      .catch(() => {})
      .finally(() => setLoadingVitals(false));
  }, [mineParam]);

  function selectCondition(c: string) {
    setSelectedCondition(c);
    loadMedicinePatterns(c);
    loadVitalTrends(c);
  }

  function loadAiInsights() {
    setAiLoading(true);
    setAiInsights(null);
    appointmentApi.get(`/analytics/ai-insights?v=1${mineParam}`)
      .then(r => setAiInsights(r.data?.insights ?? 'No insights available.'))
      .catch((err: any) => {
        const msg = err?.response?.data?.message ?? err?.message ?? 'Unknown error';
        setAiInsights(`⚠️ ${msg}`);
      })
      .finally(() => setAiLoading(false));
  }

  // Close export dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExport(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Print report ──────────────────────────────────────────────────────────
  function printReport() {
    const win = window.open('', '_blank', 'width=960,height=720');
    if (!win) return;
    const now = new Date().toLocaleDateString('en-IN', { dateStyle: 'long' });
    const scope = mineOnly ? 'My Patients' : 'All Patients';

    const condTable = conditionData?.distribution.length
      ? `<h2>Condition Distribution</h2><table><thead><tr><th>#</th><th>Condition</th><th>Patients</th><th>Prevalence</th></tr></thead><tbody>
${conditionData.distribution.map((c, i) => `<tr><td>${i+1}</td><td>${c.condition}</td><td>${c.count}</td><td>${c.percentage}%</td></tr>`).join('')}
</tbody></table>` : '';

    const ageTable = ageData?.length
      ? `<h2>Age Distribution</h2><table><thead><tr><th>Age Group</th><th>Patients</th><th>Percentage</th></tr></thead><tbody>
${ageData.map(b => `<tr><td>${b.ageGroup} yrs</td><td>${b.count}</td><td>${b.percentage}%</td></tr>`).join('')}
</tbody></table>` : '';

    const medTable = medicineData?.medicines.length
      ? `<h2>Top Prescribed Medicines${selectedCondition ? ` — ${selectedCondition}` : ''}</h2><table><thead><tr><th>#</th><th>Medicine</th><th>Prescriptions</th></tr></thead><tbody>
${medicineData.medicines.map((m, i) => `<tr><td>${i+1}</td><td>${m.medicine}</td><td>${m.count}</td></tr>`).join('')}
</tbody></table>` : '';

    const vitalTable = vitalData
      ? `<h2>Average Vitals — ${vitalData.condition}</h2><p><em>${vitalData.patientCount} patients · ${vitalData.consultationCount} consultations analysed</em></p>
<table><thead><tr><th>Parameter</th><th>Population Average</th></tr></thead><tbody>
${[['Blood Pressure', vitalData.averageVitals.bpSystolic && vitalData.averageVitals.bpDiastolic ? `${vitalData.averageVitals.bpSystolic}/${vitalData.averageVitals.bpDiastolic} mmHg` : null],
['Pulse Rate', vitalData.averageVitals.pulseRate ? `${vitalData.averageVitals.pulseRate} bpm` : null],
['SpO₂', vitalData.averageVitals.spo2 ? `${vitalData.averageVitals.spo2}%` : null],
['Random Blood Sugar', vitalData.averageVitals.rbsMgDl ? `${vitalData.averageVitals.rbsMgDl} mg/dL` : null],
['BMI', vitalData.averageVitals.bmi ? String(vitalData.averageVitals.bmi) : null],
].filter(([,v]) => v).map(([l,v]) => `<tr><td>${l}</td><td>${v}</td></tr>`).join('')}
</tbody></table>` : '';

    const labTable = labData?.topTests.length
      ? `<h2>Lab Tests — Top Ordered (Last ${period} days)</h2>
<p>Total orders: ${labData.totalOrders} | Completion rate: ${labData.completionRate}% | Abnormal rate: ${labData.abnormalRate}%</p>
<table><thead><tr><th>#</th><th>Test</th><th>Orders</th></tr></thead><tbody>
${labData.topTests.map((t,i) => `<tr><td>${i+1}</td><td>${t.test}</td><td>${t.count}</td></tr>`).join('')}
</tbody></table>` : '';

    const aiSection = aiInsights
      ? `<h2>AI Population Insights</h2><div style="font-size:12px;line-height:1.6;background:#fafafa;border:1px solid #ddd;padding:16px;white-space:pre-wrap;">${aiInsights.replace(/## /g, '\n').replace(/- /g, '• ')}</div>` : '';

    const doctorSection = isDoctor && doctorStats
      ? `<h2>My Activity Summary</h2><table><thead><tr><th>Metric</th><th>Count</th></tr></thead><tbody>
<tr><td>Consultations</td><td>${doctorStats.totalConsultations}</td></tr>
<tr><td>Prescriptions</td><td>${doctorStats.totalPrescriptions}</td></tr>
<tr><td>Unique Patients</td><td>${doctorStats.uniquePatients}</td></tr>
</tbody></table>` : '';

    win.document.write(`<!DOCTYPE html><html><head><title>Analytics Report</title>
<style>
body{font-family:'Times New Roman',serif;margin:30mm 25mm;color:#000;font-size:12pt;}
h1{font-size:18pt;border-bottom:2pt solid #000;padding-bottom:6pt;margin-bottom:4pt;}
h2{font-size:13pt;margin-top:18pt;margin-bottom:4pt;color:#1a1a1a;}
p{margin:2pt 0 6pt;}
.kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:10pt;margin:10pt 0;}
.kpi-box{border:1pt solid #999;padding:10pt;text-align:center;}
.kv{font-size:22pt;font-weight:bold;display:block;}
.kl{font-size:9pt;color:#555;}
table{width:100%;border-collapse:collapse;margin:6pt 0 14pt;font-size:11pt;}
th,td{border:1pt solid #bbb;padding:4pt 8pt;text-align:left;}
th{background:#f0f0f0;font-weight:bold;}
.footer{margin-top:30pt;font-size:9pt;color:#666;border-top:1pt solid #ccc;padding-top:6pt;}
@media print{@page{margin:20mm;}body{margin:0;}}
</style></head><body>
<h1>Patient Analytics Report</h1>
<p><strong>Generated:</strong> ${now} &nbsp;&nbsp; <strong>Scope:</strong> ${scope} &nbsp;&nbsp; <strong>Lab period:</strong> Last ${period} days</p>
${conditionData ? `<div class="kpi">
<div class="kpi-box"><span class="kv">${conditionData.totalPatients}</span><span class="kl">Total Patients</span></div>
<div class="kpi-box"><span class="kv">${conditionData.patientsTagged}</span><span class="kl">Patients Tagged</span></div>
<div class="kpi-box"><span class="kv">${conditionData.distribution.length}</span><span class="kl">Unique Conditions</span></div>
<div class="kpi-box"><span class="kv" style="font-size:14pt;">${conditionData.distribution[0]?.condition ?? '—'}</span><span class="kl">Top Condition</span></div>
</div>` : ''}
${doctorSection}${condTable}${ageTable}${medTable}${vitalTable}${labTable}${aiSection}
<div class="footer">Generated by Megnim HMS &nbsp;|&nbsp; ${now} &nbsp;|&nbsp; For clinical reference only. Not a substitute for physician judgement.</div>
</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  }

  // ── Export helpers ────────────────────────────────────────────────────────
  const exports = [
    {
      label: 'Condition Distribution',
      disabled: !conditionData?.distribution.length,
      action: () => downloadCSV('conditions.csv',
        ['Rank', 'Condition', 'Patient Count', 'Prevalence (%)'],
        (conditionData?.distribution ?? []).map((c, i) => [i + 1, c.condition, c.count, c.percentage])
      ),
    },
    {
      label: 'Age Distribution',
      disabled: !ageData?.length,
      action: () => downloadCSV('age-distribution.csv',
        ['Age Group', 'Patient Count', 'Percentage (%)'],
        (ageData ?? []).map(b => [b.ageGroup, b.count, b.percentage])
      ),
    },
    {
      label: 'Medicine Patterns',
      disabled: !medicineData?.medicines.length,
      action: () => downloadCSV('medicine-patterns.csv',
        ['Rank', 'Medicine', 'Prescription Count'],
        (medicineData?.medicines ?? []).map((m, i) => [i + 1, m.medicine, m.count])
      ),
    },
    {
      label: 'Lab Top Tests',
      disabled: !labData?.topTests.length,
      action: () => downloadCSV('lab-top-tests.csv',
        ['Rank', 'Test Name', 'Order Count'],
        (labData?.topTests ?? []).map((t, i) => [i + 1, t.test, t.count])
      ),
    },
    {
      label: 'Lab Daily Volume',
      disabled: !labData?.dailyVolume.length,
      action: () => downloadCSV('lab-daily-volume.csv',
        ['Date', 'Orders'],
        (labData?.dailyVolume ?? []).map(d => [d.date, d.count])
      ),
    },
  ];

  const topConditions = conditionData?.distribution.slice(0, 10) ?? [];

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Patient Analytics</h1>
          <p className="text-xs text-gray-500 mt-0.5">Disease grouping · prescription patterns · lab data · AI insights</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period selector */}
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>

          {/* Mine/All toggle */}
          {isDoctor && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              <button onClick={() => setMineOnly(false)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${!mineOnly ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                All Patients
              </button>
              <button onClick={() => setMineOnly(true)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${mineOnly ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                My Patients
              </button>
            </div>
          )}

          {/* Export dropdown */}
          <div className="relative" ref={exportRef}>
            <button onClick={() => setShowExport(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export CSV
            </button>
            {showExport && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-20">
                {exports.map(ex => (
                  <button key={ex.label} disabled={ex.disabled}
                    onClick={() => { ex.action(); setShowExport(false); }}
                    className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-blue-50 disabled:text-gray-300 disabled:cursor-not-allowed border-b border-gray-50 last:border-0">
                    {ex.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Print / PDF */}
          <button onClick={printReport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Print PDF
          </button>

          {/* AI Insights */}
          <button onClick={loadAiInsights} disabled={aiLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-blue-600 text-white text-xs font-semibold rounded-lg shadow hover:opacity-90 disabled:opacity-60">
            {aiLoading ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Generating…</> : <>✨ AI Insights</>}
          </button>
        </div>
      </div>

      {/* ── Doctor stats strip ─────────────────────────────────────────────── */}
      {isDoctor && doctorStats && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'My Consultations', value: doctorStats.totalConsultations, color: 'from-blue-600 to-blue-700' },
            { label: 'My Prescriptions', value: doctorStats.totalPrescriptions, color: 'from-teal-600 to-teal-700' },
            { label: 'My Unique Patients', value: doctorStats.uniquePatients, color: 'from-purple-600 to-purple-700' },
          ].map(card => (
            <div key={card.label} className={`bg-gradient-to-br ${card.color} rounded-xl p-4 text-white`}>
              <p className="text-xs font-medium uppercase tracking-wide opacity-70">{card.label}</p>
              <p className="text-2xl font-bold mt-0.5">{card.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Population KPI strip ───────────────────────────────────────────── */}
      {!loadingConditions && conditionData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Patients', value: conditionData.totalPatients.toLocaleString(), color: 'text-blue-700 bg-blue-50 border-blue-200' },
            { label: 'Patients Tagged', value: `${conditionData.patientsTagged} (${Math.round(conditionData.patientsTagged / (conditionData.totalPatients || 1) * 100)}%)`, color: 'text-green-700 bg-green-50 border-green-200' },
            { label: 'Unique Conditions', value: conditionData.distribution.length, color: 'text-purple-700 bg-purple-50 border-purple-200' },
            { label: 'Top Condition', value: conditionData.distribution[0]?.condition ?? '—', color: 'text-amber-700 bg-amber-50 border-amber-200' },
          ].map(c => (
            <div key={c.label} className={`rounded-xl border p-4 ${c.color}`}>
              <p className="text-xs font-medium uppercase tracking-wide opacity-70">{c.label}</p>
              <p className="text-lg font-bold mt-0.5 leading-tight">{c.value}</p>
            </div>
          ))}
        </div>
      )}
      {loadingConditions && <div className="h-16 flex items-center justify-center text-gray-400 text-sm">Loading…</div>}

      {/* ── Mine scope banner ─────────────────────────────────────────────── */}
      {mineOnly && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 flex items-center gap-2 text-xs text-blue-700">
          <span className="font-semibold">My Patients scope:</span>
          <span>Analytics scoped to patients you have previously consulted.</span>
          <button onClick={() => setMineOnly(false)} className="ml-auto underline text-blue-500 hover:text-blue-700">Show all</button>
        </div>
      )}

      {/* ── Row 1: Condition chart + Age distribution ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Condition distribution */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Condition Distribution</h2>
              <p className="text-xs text-gray-500">Click a bar/slice to drill into prescriptions</p>
            </div>
            <div className="flex items-center gap-2">
              {selectedCondition && (
                <button onClick={() => { setSelectedCondition(''); loadMedicinePatterns(''); }}
                  className="text-xs text-gray-400 hover:text-gray-700 underline">Clear</button>
              )}
              {(['bar', 'pie'] as const).map(t => (
                <button key={t} onClick={() => setChartType(t)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${chartType === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {t === 'bar' ? 'Bar' : 'Pie'}
                </button>
              ))}
            </div>
          </div>
          {loadingConditions ? <Spinner /> : topConditions.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No condition data yet</div>
          ) : chartType === 'bar' ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topConditions} margin={{ top: 4, right: 8, bottom: 70, left: 0 }}
                onClick={d => d?.activePayload?.[0]?.payload?.condition && selectCondition(d.activePayload[0].payload.condition)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="condition" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number, _: string, item: any) => [`${v} patients (${item?.payload?.percentage ?? 0}%)`, 'Count']} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} cursor="pointer">
                  {topConditions.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={topConditions} dataKey="count" nameKey="condition" cx="50%" cy="50%" outerRadius={80}
                  onClick={d => selectCondition(d.condition)} cursor="pointer">
                  {topConditions.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Legend formatter={v => <span className="text-xs">{v}</span>} wrapperStyle={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number, k: string, item: any) => [`${v} patients (${item?.payload?.percentage ?? 0}%)`, k]} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Age distribution */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Age Distribution</h2>
            <p className="text-xs text-gray-500">Patient breakdown by age group</p>
          </div>
          {loadingAge ? <Spinner /> : !ageData?.length ? (
            <div className="text-center py-10 text-gray-400 text-sm">No age data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ageData} margin={{ top: 4, right: 8, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="ageGroup" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number, _: string, item: any) => [`${v} patients (${item?.payload?.percentage ?? 0}%)`, 'Count']} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {ageData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Row 2: Medicine patterns + Average vitals ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Prescription patterns */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Prescription Patterns</h2>
              <p className="text-xs text-gray-500">
                {selectedCondition ? `Filtered: ${selectedCondition}` : 'Click condition chart to filter'}
              </p>
            </div>
            {medicineData?.medicines.length ? (
              <button onClick={() => downloadCSV('medicines.csv', ['Rank', 'Medicine', 'Count'],
                  medicineData.medicines.map((m, i) => [i + 1, m.medicine, m.count]))}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                CSV
              </button>
            ) : null}
          </div>
          {loadingMeds ? <Spinner /> : medicineData ? (
            medicineData.medicines.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No prescription data for this condition</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {medicineData.medicines.map((m, i) => (
                  <div key={m.medicine} className="flex items-center gap-2">
                    <span className="w-4 text-xs text-gray-400 text-right flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-gray-800 truncate">{m.medicine}</span>
                        <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{m.count}×</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${Math.round(m.count / (medicineData.medicines[0]?.count || 1) * 100)}%`, backgroundColor: PALETTE[i % PALETTE.length] }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Select a condition from the chart above</p>
          )}
        </div>

        {/* Average vitals */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Average Vitals</h2>
          <p className="text-xs text-gray-500 mb-3">
            {selectedCondition ? `Population averages — ${selectedCondition}` : 'Select a condition to view vitals'}
          </p>
          {loadingVitals ? <Spinner /> : vitalData ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">{vitalData.patientCount} patients · {vitalData.consultationCount} consultations</p>
              {[
                { label: 'Blood Pressure', value: vitalData.averageVitals.bpSystolic && vitalData.averageVitals.bpDiastolic ? `${vitalData.averageVitals.bpSystolic}/${vitalData.averageVitals.bpDiastolic} mmHg` : null },
                { label: 'Pulse Rate', value: vitalData.averageVitals.pulseRate ? `${vitalData.averageVitals.pulseRate} bpm` : null },
                { label: 'SpO₂', value: vitalData.averageVitals.spo2 ? `${vitalData.averageVitals.spo2}%` : null },
                { label: 'RBS', value: vitalData.averageVitals.rbsMgDl ? `${vitalData.averageVitals.rbsMgDl} mg/dL` : null },
                { label: 'BMI', value: vitalData.averageVitals.bmi ? String(vitalData.averageVitals.bmi) : null },
              ].filter(v => v.value).map(v => (
                <div key={v.label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-600">{v.label}</span>
                  <span className="text-sm font-semibold text-gray-900">{v.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Select a condition from the chart</p>
          )}
        </div>
      </div>

      {/* ── Row 3: Lab summary ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Lab Analytics</h2>
            <p className="text-xs text-gray-500">Order volume, test frequency and abnormal rates — last {PERIODS.find(p => p.value === period)?.label}</p>
          </div>
          {labData?.topTests.length ? (
            <button onClick={() => downloadCSV('lab-top-tests.csv', ['Rank', 'Test', 'Orders'],
                labData.topTests.map((t, i) => [i + 1, t.test, t.count]))}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              CSV
            </button>
          ) : null}
        </div>

        {loadingLab ? <Spinner /> : !labData || labData.totalOrders === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No lab orders in this period</div>
        ) : (
          <>
            {/* Lab KPIs */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Total Orders', value: labData.totalOrders, color: 'text-blue-700 bg-blue-50 border-blue-200' },
                { label: 'Completion Rate', value: `${labData.completionRate}%`, color: 'text-green-700 bg-green-50 border-green-200' },
                { label: 'Abnormal Rate', value: `${labData.abnormalRate}%`, color: labData.abnormalRate > 20 ? 'text-red-700 bg-red-50 border-red-200' : 'text-amber-700 bg-amber-50 border-amber-200' },
              ].map(c => (
                <div key={c.label} className={`rounded-xl border p-3 ${c.color}`}>
                  <p className="text-xs font-medium opacity-70">{c.label}</p>
                  <p className="text-xl font-bold mt-0.5">{c.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top tests */}
              {labData.topTests.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">Top Tests Ordered</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={labData.topTests} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="test" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip formatter={(v: number) => [`${v} orders`, 'Count']} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {labData.topTests.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Daily volume trend */}
              {labData.dailyVolume.length > 1 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">Daily Order Volume</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={labData.dailyVolume} margin={{ top: 4, right: 8, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" interval={Math.floor(labData.dailyVolume.length / 8)} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => [v, 'Orders']} />
                      <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── AI Insights ─────────────────────────────────────────────────────── */}
      {(aiInsights || aiLoading) && (
        <div className="bg-gradient-to-br from-violet-50 to-blue-50 rounded-2xl border border-violet-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span>✨</span>
            <h2 className="text-sm font-semibold text-violet-900">AI Population Insights</h2>
            {mineOnly && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">My Patients</span>}
            {aiLoading && <div className="w-4 h-4 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin ml-auto" />}
          </div>
          {aiInsights && (
            <div className="text-sm text-gray-800 space-y-1 leading-relaxed">
              {aiInsights.split('\n').map((line, i) => {
                if (line.startsWith('## ')) return <p key={i} className="text-xs font-semibold text-violet-800 mt-3 mb-0.5">{line.replace('## ', '')}</p>;
                if (line.startsWith('- ')) return <p key={i} className="text-xs text-gray-700 pl-3">• {line.slice(2)}</p>;
                if (line.startsWith('*')) return <p key={i} className="text-xs text-gray-400 italic mt-2">{line}</p>;
                return line ? <p key={i} className="text-xs text-gray-700">{line}</p> : null;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
