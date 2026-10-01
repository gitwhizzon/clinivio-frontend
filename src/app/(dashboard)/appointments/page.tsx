'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { appointmentApi, patientApi, iamApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PatientHistoryDrawer } from '@/components/PatientHistoryDrawer';
import { DismissModal } from '@/components/DismissModal';

interface Appointment {
  id: string;
  tokenNumber: number;
  status: string;
  appointmentType: string;
  visitType: string;
  chiefComplaint?: string;
  scheduledAt?: string;
  registeredAt: string;
  patient: { id: string; firstName: string; lastName: string; uhid: string; phone: string; dob?: string; gender?: string; bloodGroup?: string };
  doctor: { firstName: string; lastName: string };
  slot?: { slotDate: string; startTime: string };
}

interface PatientOption { id: string; firstName: string; lastName: string; uhid: string; phone: string }
interface DoctorOption { id: string; firstName: string; lastName: string; role?: string }
interface DepartmentOption { id: string; name: string }
interface AvailableSlot { id: string; slotDate: string; startTime: string; endTime: string; maxPatients: number; bookedCount: number }

const STATUS_COLORS: Record<string, string> = {
  REGISTERED: 'bg-yellow-100 text-yellow-700',
  PENDING_PAYMENT: 'bg-orange-100 text-orange-700',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  CHECKED_IN: 'bg-teal-100 text-teal-700',
  IN_PROGRESS: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-700',
  NO_SHOW: 'bg-red-50 text-red-400',
};

const VISIT_TYPES = ['OPD', 'IPD'];
const APPT_TYPES = ['IN_PERSON', 'VIDEO', 'FOLLOW_UP'];

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function currentTime() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(Math.floor(now.getMinutes() / 15) * 15).padStart(2, '0');
  return `${h}:${m}`;
}

function BookingModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (appointmentId: string, visitType: string) => void;
}) {
  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState<PatientOption[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [visitType, setVisitType] = useState('OPD');
  const [appointmentType, setAppointmentType] = useState('IN_PERSON');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [referredBy, setReferredBy] = useState('');
  const [opinionObtainedBy, setOpinionObtainedBy] = useState('');
  const [scheduledDate, setScheduledDate] = useState(todayDate());
  const [scheduledTime, setScheduledTime] = useState(currentTime());
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [payAtCounter, setPayAtCounter] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function loadLookups() {
      try {
        const [docRes, deptRes] = await Promise.all([
          iamApi.get('/users?role=DOCTOR&limit=100'),
          appointmentApi.get('/departments'),
        ]);
        const docBody = docRes.data;
        const allUsers: DoctorOption[] = docBody?.data || docBody || [];
        setDoctors(allUsers.filter((u) => u.role === 'DOCTOR'));
        const deptBody = deptRes.data;
        setDepartments(deptBody?.data || deptBody || []);
      } catch {
        // non-fatal
      }
    }
    loadLookups();
  }, []);

  // Doctor + date together determine which pre-configured slots (if any) are
  // available. Not every doctor has slots configured — when none exist, the
  // freeform time input below is kept as a fallback so booking still works.
  useEffect(() => {
    setSelectedSlotId('');
    if (!doctorId || !scheduledDate) { setSlots([]); return; }
    setSlotsLoading(true);
    appointmentApi.get(`/slots/available?doctorId=${doctorId}&date=${scheduledDate}`)
      .then(res => setSlots(Array.isArray(res.data) ? res.data : (res.data?.data ?? [])))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [doctorId, scheduledDate]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!patientQuery.trim()) { setPatientResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await patientApi.get(`/patients/search?q=${encodeURIComponent(patientQuery)}&limit=8`);
        const body = res.data;
        setPatientResults(body?.data || body || []);
        setShowPatientDropdown(true);
      } catch { setPatientResults([]); }
    }, 300);
  }, [patientQuery]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPatient) { setError('Select a patient'); return; }
    if (!doctorId) { setError('Select a doctor'); return; }
    if (slots.length > 0 && !selectedSlotId) { setError('Select a time slot'); return; }
    setSaving(true);
    setError(null);
    try {
      // When a slot is picked, the backend derives scheduledAt/token from the
      // slot itself and atomically checks+increments its booked count — don't
      // send a freeform scheduledAt alongside it. Fall back to freeform
      // date+time only when this doctor has no slots configured for the date.
      const scheduledAt = `${scheduledDate}T${scheduledTime}:00`;
      const res = await appointmentApi.post('/appointments', {
        patientId: selectedPatient.id,
        doctorId,
        ...(departmentId && { departmentId }),
        ...(selectedSlotId ? { slotId: selectedSlotId } : { scheduledAt }),
        visitType,
        appointmentType,
        ...(chiefComplaint.trim() && { chiefComplaint: chiefComplaint.trim() }),
        ...(referredBy.trim() && { referredBy: referredBy.trim() }),
        ...(opinionObtainedBy.trim() && { opinionObtainedBy: opinionObtainedBy.trim() }),
        payAtCounter,
      });
      onSuccess(res.data?.id || '', visitType);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const msg = e?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to book appointment');
      // The selected slot may have just been taken by another booking (race
      // condition) — refresh the list so the stale/full slot disappears.
      if (selectedSlotId && doctorId && scheduledDate) {
        appointmentApi.get(`/slots/available?doctorId=${doctorId}&date=${scheduledDate}`)
          .then(r => setSlots(Array.isArray(r.data) ? r.data : (r.data?.data ?? [])))
          .catch(() => {});
        setSelectedSlotId('');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Book New Appointment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
          )}

          {/* Patient search */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient <span className="text-red-500">*</span></label>
            {selectedPatient ? (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                  <p className="text-xs text-gray-500">{selectedPatient.uhid} · {selectedPatient.phone}</p>
                </div>
                <button type="button" onClick={() => { setSelectedPatient(null); setPatientQuery(''); }} className="text-xs text-blue-600 hover:text-blue-800">Change</button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                  onFocus={() => patientResults.length > 0 && setShowPatientDropdown(true)}
                  placeholder="Search by name, phone, or UHID..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {showPatientDropdown && patientResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {patientResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-sm border-b border-gray-50 last:border-0"
                        onClick={() => { setSelectedPatient(p); setPatientQuery(''); setShowPatientDropdown(false); }}
                      >
                        <p className="font-medium text-gray-900">{p.firstName} {p.lastName}</p>
                        <p className="text-xs text-gray-400">{p.uhid} · {p.phone}</p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Date & Doctor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={todayDate()}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Doctor <span className="text-red-500">*</span></label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">— Select doctor —</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Time — pre-configured slots for this doctor/date if any exist, else a freeform time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time <span className="text-red-500">*</span></label>
            {!doctorId ? (
              <p className="text-xs text-gray-400 px-1 py-2">Select a doctor to see available times</p>
            ) : slotsLoading ? (
              <p className="text-xs text-gray-400 px-1 py-2">Checking availability…</p>
            ) : slots.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((s) => {
                  const remaining = s.maxPatients - s.bookedCount;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSlotId(s.id)}
                      className={cn(
                        'py-2 text-xs font-medium rounded-lg border transition-colors',
                        selectedSlotId === s.id
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                      )}
                    >
                      {s.startTime.slice(0, 5)}
                      <span className={cn('block text-[10px]', selectedSlotId === s.id ? 'text-blue-100' : 'text-gray-400')}>
                        {remaining} left
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <p className="text-xs text-gray-400 mt-1">No pre-configured slots for this doctor/date — booking a freeform time.</p>
              </>
            )}
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">— Select department —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Visit type + Appointment type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Visit Type</label>
              <div className="flex gap-2">
                {VISIT_TYPES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisitType(v)}
                    className={cn(
                      'flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                      visitType === v
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                    )}
                  >{v}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
              <select
                value={appointmentType}
                onChange={(e) => setAppointmentType(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {APPT_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          {/* IPD notice */}
          {visitType === 'IPD' && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-lg px-3 py-2.5 flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">🛏️</span>
              <p>An IPD appointment will be created. After booking, go to <strong>IPD Admissions</strong> to assign a room and bed for the patient.</p>
            </div>
          )}

          {/* Chief complaint */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chief Complaint <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
            <textarea
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              rows={2}
              placeholder="Describe the reason for visit..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Referred by & Opinion obtained by */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Referred By <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
              <input
                type="text"
                value={referredBy}
                onChange={(e) => setReferredBy(e.target.value)}
                placeholder="Dr. Name / Hospital"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opinion Obtained By <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
              <input
                type="text"
                value={opinionObtainedBy}
                onChange={(e) => setOpinionObtainedBy(e.target.value)}
                placeholder="Specialist / Consultant"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Pay at counter */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={payAtCounter}
              onChange={(e) => setPayAtCounter(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Collect payment at billing counter</span>
          </label>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving ? (
                <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Booking…</>
              ) : visitType === 'IPD' ? 'Create IPD Appointment' : 'Book Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AppointmentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [newApptId, setNewApptId] = useState<string | null>(null);
  const [lastVisitType, setLastVisitType] = useState<string>('OPD');
  const [historyPatient, setHistoryPatient] = useState<Appointment['patient'] | null>(null);
  const [dismissTarget, setDismissTarget] = useState<Appointment | null>(null);

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await appointmentApi.get(`/appointments?page=${page}&limit=20`);
      const body = res.data;
      setAppointments(body?.data || body || []);
      setTotal(body?.total || body?.pagination?.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  function handleBookingSuccess(appointmentId: string, visitType: string) {
    setShowModal(false);
    setNewApptId(appointmentId);
    setLastVisitType(visitType);
    const msg = visitType === 'IPD'
      ? 'IPD appointment created! Go to IPD Admissions to assign a room and bed.'
      : 'Appointment booked! Patient is awaiting payment at Billing Counter.';
    setSuccessMsg(msg);
    setTimeout(() => { setSuccessMsg(null); setNewApptId(null); }, 8000);
    fetchAppointments();
  }

  function formatDateTime(appt: Appointment) {
    const raw = appt.slot?.slotDate || appt.scheduledAt || appt.registeredAt;
    if (!raw) return { date: '—', time: '' };
    const d = new Date(raw);
    const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = appt.slot?.startTime ||
      d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return { date, time };
  }

  return (
    <div>
      {showModal && <BookingModal onClose={() => setShowModal(false)} onSuccess={handleBookingSuccess} />}
      {historyPatient && (
        <PatientHistoryDrawer patient={historyPatient} onClose={() => setHistoryPatient(null)} />
      )}
      {dismissTarget && (
        <DismissModal
          appointment={dismissTarget}
          onClose={() => setDismissTarget(null)}
          onDismissed={() => { setDismissTarget(null); fetchAppointments(); }}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Appointments</h1>
          <p className="text-sm text-gray-500">{total} total appointments</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <span className="text-base leading-none">+</span>
          New Appointment
        </button>
      </div>

      {successMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-green-500 text-base">✓</span>
            <span>{successMsg}</span>
          </div>
          {lastVisitType === 'IPD' ? (
            <button
              onClick={() => router.push('/ipd')}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to IPD Admissions
            </button>
          ) : (
            <button
              onClick={() => router.push('/billing')}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Go to Billing Counter
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">Loading...</div>
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
            <p>No appointments found</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Book First Appointment
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Token</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Patient</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Doctor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date & Time</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {appointments.map((appt) => {
                const { date, time } = formatDateTime(appt);
                const isNew = appt.id === newApptId;
                return (
                  <tr key={appt.id} className={cn('transition-colors', isNew ? 'bg-green-50' : 'hover:bg-gray-50')}>
                    <td className="px-4 py-3 font-mono font-bold text-gray-900">#{appt.tokenNumber}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{appt.patient?.firstName} {appt.patient?.lastName}</p>
                      <p className="text-xs text-gray-400">{appt.patient?.uhid}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      Dr. {appt.doctor?.firstName} {appt.doctor?.lastName}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <p>{date}</p>
                      {time && <p className="text-xs text-gray-400">{time}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                        {appt.visitType || ''}
                      </span>
                      <span className="ml-1 text-xs text-gray-400">{appt.appointmentType?.toLowerCase().replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[appt.status] || 'bg-gray-100 text-gray-600'}`}>
                        {appt.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {appt.visitType === 'IPD' && (
                          <button
                            onClick={() => router.push('/ipd')}
                            className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
                          >
                            Admit
                          </button>
                        )}
                        <button
                          onClick={() => setHistoryPatient(appt.patient)}
                          className="px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors whitespace-nowrap"
                        >
                          History
                        </button>
                        {!['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(appt.status) && (
                          <button
                            onClick={() => setDismissTarget(appt)}
                            className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {total > 20 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 20)}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={appointments.length < 20}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
