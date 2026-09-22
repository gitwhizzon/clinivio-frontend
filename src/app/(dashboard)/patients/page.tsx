'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { patientApi, appointmentApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import { PatientHistoryDrawer } from '@/components/PatientHistoryDrawer';

interface Patient {
  id: string;
  uhid: string;
  firstName: string;
  lastName: string;
  phone: string;
  whatsappPhone?: string;
  email?: string;
  gender?: string;
  dob?: string;
  bloodGroup?: string;
  preferredLanguage: string;
  consentGivenAt?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  conditions?: string[];
  createdAt: string;
}

const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];
const LANGUAGES = ['EN', 'HI', 'TA', 'TE', 'KN', 'BN'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const CONDITION_COLORS = [
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-red-100 text-red-700 border-red-200',
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-green-100 text-green-700 border-green-200',
];

function conditionColor(c: string) {
  const idx = Math.abs(c.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0)) % CONDITION_COLORS.length;
  return CONDITION_COLORS[idx];
}

// ─── Condition tag input (reusable) ──────────────────────────────────────────

function ConditionTagInput({
  value,
  onChange,
  commonConditions,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  commonConditions: string[];
}) {
  const [search, setSearch] = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowDrop(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const filtered = commonConditions.filter(
    c => !value.includes(c) && c.toLowerCase().includes(search.toLowerCase()),
  );

  function add(c: string) {
    const clean = c.trim();
    if (clean && !value.includes(clean)) onChange([...value, clean]);
    setSearch('');
    setShowDrop(false);
  }

  function remove(c: string) {
    onChange(value.filter(x => x !== c));
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && search.trim()) {
      e.preventDefault();
      add(search);
    }
    if (e.key === 'Backspace' && !search && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div ref={ref} className="relative">
      <div className="min-h-[42px] w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-blue-500 flex flex-wrap gap-1.5 items-center">
        {value.map(c => (
          <span key={c} className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', conditionColor(c))}>
            {c}
            <button type="button" onClick={() => remove(c)} className="hover:opacity-70 leading-none font-bold">&times;</button>
          </span>
        ))}
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setShowDrop(true); }}
          onFocus={() => setShowDrop(true)}
          onKeyDown={onKey}
          placeholder={value.length ? '' : 'Search or type a condition…'}
          className="flex-1 min-w-[140px] outline-none text-sm bg-transparent placeholder-gray-400"
        />
      </div>
      {showDrop && (search || filtered.length > 0) && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 && search.trim() ? (
            <button type="button" onMouseDown={() => add(search)}
              className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 text-blue-600">
              Add &ldquo;{search}&rdquo;
            </button>
          ) : (
            filtered.slice(0, 20).map(c => (
              <button type="button" key={c} onMouseDown={() => add(c)}
                className="w-full px-3 py-2 text-sm text-left hover:bg-orange-50 hover:text-orange-700">
                {c}
              </button>
            ))
          )}
        </div>
      )}
      <p className="text-xs text-gray-400 mt-1">Select from list or type a custom condition, press Enter to add</p>
    </div>
  );
}

// ─── Enroll / Edit modal ──────────────────────────────────────────────────────

type EnrollForm = {
  firstName: string; lastName: string; phone: string; whatsappPhone: string;
  email: string; dob: string; gender: string; bloodGroup: string;
  preferredLanguage: string; address: string; abhaId: string;
  emergencyContactName: string; emergencyContactPhone: string; consentGiven: boolean;
};

const BLANK_FORM: EnrollForm = {
  firstName: '', lastName: '', phone: '', whatsappPhone: '',
  email: '', dob: '', gender: 'MALE', bloodGroup: '',
  preferredLanguage: 'EN', address: '', abhaId: '',
  emergencyContactName: '', emergencyContactPhone: '', consentGiven: false,
};

function EnrollModal({ initial, onClose, onSuccess }: {
  initial?: Patient;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState<EnrollForm>(initial ? {
    firstName: initial.firstName,
    lastName: initial.lastName ?? '',
    phone: initial.phone,
    whatsappPhone: initial.whatsappPhone ?? '',
    email: initial.email ?? '',
    dob: initial.dob ? initial.dob.slice(0, 10) : '',
    gender: initial.gender ?? 'MALE',
    bloodGroup: initial.bloodGroup ?? '',
    preferredLanguage: initial.preferredLanguage ?? 'EN',
    address: initial.address ?? '',
    abhaId: '',
    emergencyContactName: initial.emergencyContactName ?? '',
    emergencyContactPhone: initial.emergencyContactPhone ?? '',
    consentGiven: !!initial.consentGivenAt,
  } : BLANK_FORM);
  const [conditions, setConditions] = useState<string[]>(initial?.conditions ?? []);
  const [commonConditions, setCommonConditions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    appointmentApi.get('/analytics/common-conditions')
      .then(r => setCommonConditions(r.data?.conditions ?? []))
      .catch(() => {});
  }, []);

  const set = (field: keyof EnrollForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName || undefined,
        phone: form.phone,
        whatsappPhone: form.whatsappPhone || undefined,
        email: form.email || undefined,
        dob: form.dob || undefined,
        gender: form.gender || undefined,
        bloodGroup: form.bloodGroup || undefined,
        preferredLanguage: form.preferredLanguage,
        address: form.address || undefined,
        abhaId: form.abhaId || undefined,
        emergencyContactName: form.emergencyContactName || undefined,
        emergencyContactPhone: form.emergencyContactPhone || undefined,
        consentGiven: form.consentGiven,
      };

      let patientId: string;
      if (isEdit) {
        await patientApi.patch(`/patients/${initial!.id}`, payload);
        patientId = initial!.id;
      } else {
        const res = await patientApi.post('/patients', payload);
        patientId = res.data?.id;
      }

      // The patient record above is already saved at this point — a failure
      // in this second, separate request must never be reported as if
      // nothing was saved (that's what was driving people to hit Save again
      // and create duplicate patients). Conditions are non-critical enough
      // to fail quietly and let the user re-add them via Edit afterward.
      if (patientId) {
        try {
          await patientApi.patch(`/patients/${patientId}/conditions`, { conditions });
        } catch {
          // swallowed — see comment above
        }
      }

      onSuccess();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const msg = e?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {isEdit ? `Edit Patient — ${initial!.firstName} ${initial!.lastName ?? ''}` : 'Enroll New Patient'}
            </h2>
            {!isEdit && <p className="text-xs text-gray-400 mt-0.5">A unique UHID will be auto-generated</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

          {/* Personal info */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Personal Info</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>First Name *</label>
                <input required value={form.firstName} onChange={set('firstName')} placeholder="Ravi" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Last Name</label>
                <input value={form.lastName} onChange={set('lastName')} placeholder="Kumar" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Date of Birth</label>
                <input type="date" value={form.dob} onChange={set('dob')} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Gender</label>
                <select value={form.gender} onChange={set('gender')} className={inputCls}>
                  {GENDERS.map(g => <option key={g} value={g}>{g.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Blood Group</label>
                <select value={form.bloodGroup} onChange={set('bloodGroup')} className={inputCls}>
                  <option value="">— Select —</option>
                  {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Language Preference</label>
                <select value={form.preferredLanguage} onChange={set('preferredLanguage')} className={inputCls}>
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>ABHA ID <span className="text-gray-400 font-normal">(14-digit, optional)</span></label>
                <input value={form.abhaId} onChange={set('abhaId')} placeholder="14-digit ABHA number" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Major Conditions */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Major Conditions</p>
            <p className="text-xs text-gray-400 mb-3">Chronic or pre-existing conditions — used for clinical analytics and AI insights</p>
            <ConditionTagInput
              value={conditions}
              onChange={setConditions}
              commonConditions={commonConditions}
            />
          </div>

          {/* Contact */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contact</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Phone *</label>
                <input required value={form.phone} onChange={set('phone')} placeholder="9876543210" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>WhatsApp Number <span className="text-gray-400 font-normal">(if different)</span></label>
                <input value={form.whatsappPhone} onChange={set('whatsappPhone')} placeholder="9876543210" className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Email</label>
                <input type="email" value={form.email} onChange={set('email')} placeholder="patient@example.com" className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Address</label>
                <textarea value={form.address} onChange={set('address')} rows={2}
                  placeholder="House no, Street, City, State, PIN" className={cn(inputCls, 'resize-none')} />
              </div>
            </div>
          </div>

          {/* Emergency contact */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Emergency Contact</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Contact Name</label>
                <input value={form.emergencyContactName} onChange={set('emergencyContactName')} placeholder="Suresh Kumar" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Contact Phone</label>
                <input value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} placeholder="9876543210" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Consent */}
          <div className="border-t border-gray-100 pt-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.consentGiven}
                onChange={e => setForm(prev => ({ ...prev, consentGiven: e.target.checked }))}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700">
                Patient has given consent for data collection and treatment as per hospital policy.
              </span>
            </label>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving
                ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{isEdit ? 'Saving…' : 'Enrolling…'}</>
                : isEdit ? 'Save Changes' : 'Enroll Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PatientsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const role = user?.role ?? '';
  const canEnroll = ['ADMIN', 'RECEPTIONIST'].includes(role);
  const canTag = ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'].includes(role);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [enrollModal, setEnrollModal] = useState<{ patient?: Patient } | null>(null);
  const [historyPatient, setHistoryPatient] = useState<Patient | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filterCondition, setFilterCondition] = useState('');

  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      const endpoint = search
        ? `/patients/search?q=${encodeURIComponent(search)}&page=${page}&limit=20`
        : `/patients?page=${page}&limit=20`;
      const res = await patientApi.get(endpoint);
      const body = res.data;
      setPatients(body?.data || body || []);
      setTotal(body?.pagination?.total || body?.total || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => {
    const t = setTimeout(fetchPatients, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [fetchPatients]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 4000); }

  function handleSuccess() {
    setEnrollModal(null);
    showToast(enrollModal?.patient ? 'Patient updated!' : 'Patient enrolled successfully!');
    fetchPatients();
  }

  const age = (dob?: string) => {
    if (!dob) return '—';
    return `${Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000))}y`;
  };

  const displayedPatients = filterCondition
    ? patients.filter(p => (p.conditions ?? []).some(c => c.toLowerCase().includes(filterCondition.toLowerCase())))
    : patients;

  return (
    <div>
      {enrollModal && (
        <EnrollModal
          initial={enrollModal.patient}
          onClose={() => setEnrollModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {historyPatient && (
        <PatientHistoryDrawer
          patient={historyPatient}
          onClose={() => setHistoryPatient(null)}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Patients</h1>
          <p className="text-sm text-gray-500">{total} registered patients</p>
        </div>
        {canEnroll && (
          <button
            onClick={() => setEnrollModal({})}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <span className="text-base leading-none">+</span> Enroll Patient
          </button>
        )}
      </div>

      {toast && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2.5 flex items-center gap-2">
          <span>✓</span> {toast}
        </div>
      )}

      <div className="mb-4 flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search by name, phone, or UHID…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[220px] max-w-md px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Filter by condition…"
          value={filterCondition}
          onChange={e => setFilterCondition(e.target.value)}
          className="px-4 py-2 text-sm border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 bg-orange-50 placeholder-orange-400 text-orange-800 w-52"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>
        ) : displayedPatients.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
            <p>{search || filterCondition ? 'No patients found matching your search' : 'No patients enrolled yet'}</p>
            {canEnroll && !search && !filterCondition && (
              <button onClick={() => setEnrollModal({})} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Enroll First Patient
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">UHID</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Conditions</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Phone</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Age / Gender</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Consent</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Registered</th>
                <th className="px-4 py-3" />
                {canEnroll && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayedPatients.map(p => {
                const conds = p.conditions ?? [];
                const visible = conds.slice(0, 2);
                const overflow = conds.length - 2;
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 font-medium">{p.uhid}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => router.push(`/patients/${p.id}`)}
                        className="font-medium text-gray-900 hover:text-blue-600 hover:underline text-left"
                      >
                        {p.firstName} {p.lastName}
                      </button>
                      {p.email && <p className="text-xs text-gray-400">{p.email}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {conds.length === 0 ? (
                        canTag ? (
                          <button
                            onClick={() => setEnrollModal({ patient: p })}
                            className="text-xs text-gray-400 hover:text-orange-600 hover:underline"
                          >
                            + Add tag
                          </button>
                        ) : <span className="text-xs text-gray-300">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 items-center">
                          {visible.map(c => (
                            <span key={c} className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium border', conditionColor(c))}>
                              {c}
                            </span>
                          ))}
                          {overflow > 0 && (
                            <span className="text-xs text-gray-400 font-medium">+{overflow} more</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.phone}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {age(p.dob)} / {p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1).toLowerCase() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${p.consentGivenAt ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {p.consentGivenAt ? 'Given' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(p.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setHistoryPatient(p)}
                        className="px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                      >
                        History
                      </button>
                    </td>
                    {canEnroll && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setEnrollModal({ patient: p })}
                          className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {total > 20 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Previous</button>
            <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 20)}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={patients.length < 20}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
