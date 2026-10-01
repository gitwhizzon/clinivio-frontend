'use client';
import { useState, useEffect } from 'react';
import { billingApi, appointmentApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface BillableServiceItem {
  id: string;
  name: string;
  code: string;
  category?: string | null;
  departmentId?: string | null;
  price: string;
  durationMinutes?: number | null;
  isTaxable: boolean;
  gstPercent?: string | null;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface Department {
  id: string;
  name: string;
}

type ModalMode = 'add' | 'edit';

function ServiceModal({ mode, item, departments, onClose, onSuccess }: {
  mode: ModalMode;
  item?: BillableServiceItem;
  departments: Department[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    name: item?.name ?? '',
    code: item?.code ?? '',
    category: item?.category ?? '',
    departmentId: item?.departmentId ?? '',
    price: item?.price ?? '',
    durationMinutes: item?.durationMinutes != null ? String(item.durationMinutes) : '',
    isTaxable: item?.isTaxable !== false,
    gstPercent: item?.gstPercent ?? '',
    description: item?.description ?? '',
    sortOrder: item?.sortOrder != null ? String(item.sortOrder) : '0',
    isActive: item?.isActive !== false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        category: form.category || undefined,
        departmentId: form.departmentId || undefined,
        price: parseFloat(form.price),
        durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes) : undefined,
        isTaxable: form.isTaxable,
        gstPercent: form.isTaxable && form.gstPercent ? parseFloat(form.gstPercent) : undefined,
        description: form.description || undefined,
        sortOrder: form.sortOrder ? parseInt(form.sortOrder) : 0,
        ...(mode === 'add' && { code: form.code }),
        ...(mode === 'edit' && { isActive: form.isActive }),
      };
      if (mode === 'add') {
        await billingApi.post('/billable-services', payload);
      } else {
        await billingApi.patch(`/billable-services/${item!.id}`, payload);
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

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {mode === 'add' ? 'New Service' : `Edit — ${item?.name}`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="X-Ray Scan" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Code * {mode === 'edit' && <span className="text-gray-400 font-normal">(read-only)</span>}
              </label>
              <input
                required={mode === 'add'}
                value={mode === 'edit' ? item!.code : form.code}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                disabled={mode === 'edit'}
                placeholder="XRAY"
                className={mode === 'edit' ? 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed font-mono' : inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Price (₹) *</label>
              <input required type="number" min="0" step="0.01" value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })}
                placeholder="500" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                placeholder="Scanning" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
              <select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })} className={inputCls}>
                <option value="">— None —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Duration (min)</label>
              <input type="number" min="0" value={form.durationMinutes}
                onChange={e => setForm({ ...form, durationMinutes: e.target.value })}
                placeholder="15" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Optional notes shown on billing" className={inputCls} />
          </div>

          <label className="flex items-center justify-between cursor-pointer pt-1">
            <span className="text-sm text-gray-700">Taxable (apply GST)</span>
            <div className="relative">
              <input type="checkbox" className="sr-only peer" checked={form.isTaxable}
                onChange={e => setForm({ ...form, isTaxable: e.target.checked })} />
              <div className="w-10 h-5 bg-gray-200 peer-checked:bg-green-500 rounded-full transition-colors" />
              <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
            </div>
          </label>

          {form.isTaxable && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">GST % override</label>
              <input type="number" min="0" max="50" step="0.01" value={form.gstPercent}
                onChange={e => setForm({ ...form, gstPercent: e.target.value })}
                placeholder="Leave blank to use tenant default" className={inputCls} />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Sort Order</label>
            <input type="number" min="0" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: e.target.value })}
              placeholder="0" className={inputCls} />
          </div>

          {mode === 'edit' && (
            <label className="flex items-center justify-between cursor-pointer pt-1">
              <span className="text-sm text-gray-700">Active</span>
              <div className="relative">
                <input type="checkbox" className="sr-only peer" checked={form.isActive}
                  onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                <div className="w-10 h-5 bg-gray-200 peer-checked:bg-green-500 rounded-full transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
              </div>
            </label>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving
                ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{mode === 'add' ? 'Creating…' : 'Saving…'}</>
                : mode === 'add' ? 'Create' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BillableServicesPage() {
  const [services, setServices] = useState<BillableServiceItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: ModalMode; item?: BillableServiceItem } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await billingApi.get('/billable-services');
      setServices(res.data || []);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchServices();
    appointmentApi.get('/departments').then(r => setDepartments(r.data || [])).catch(() => {});
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  function handleSuccess() {
    const msg = modal?.mode === 'add' ? 'Service created!' : 'Service updated!';
    setModal(null);
    showToast(msg);
    fetchServices();
  }

  async function handleDeactivate(item: BillableServiceItem) {
    if (!confirm(`Deactivate "${item.name}"? It will no longer be selectable on the billing page.`)) return;
    await billingApi.delete(`/billable-services/${item.id}`);
    showToast('Service deactivated');
    fetchServices();
  }

  const deptName = (id?: string | null) => departments.find(d => d.id === id)?.name;

  return (
    <div>
      {modal && (
        <ServiceModal
          mode={modal.mode}
          item={modal.item}
          departments={departments}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Billable Services</h1>
          <p className="text-sm text-gray-500">In-house services (scanning, dressing, observation…) available on the billing page</p>
        </div>
        <button
          onClick={() => setModal({ mode: 'add' })}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
          + New Service
        </button>
      </div>

      {toast && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2.5 flex items-center gap-2">
          <span>✓</span> {toast}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">Loading…</div>
      ) : services.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
          <p className="text-4xl">🧾</p>
          <p>No services defined yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Service</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Category</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Department</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Price</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Tax</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 w-40">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {services.map(s => (
                <tr
                  key={s.id}
                  onClick={() => setModal({ mode: 'edit', item: s })}
                  className={cn('cursor-pointer', !s.isActive ? 'opacity-50' : 'hover:bg-gray-50')}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{s.code}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.category || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{deptName(s.departmentId) || '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">₹{parseFloat(s.price).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.isTaxable ? (s.gstPercent ? `${parseFloat(s.gstPercent)}%` : 'Default') : 'Exempt'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); setModal({ mode: 'edit', item: s }); }}
                        className="px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        Edit
                      </button>
                      {s.isActive && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeactivate(s); }}
                          className="px-3 py-1 text-xs font-medium text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
