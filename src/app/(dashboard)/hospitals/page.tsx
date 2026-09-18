'use client';
import { useState, useEffect, useCallback } from 'react';
import { iamApi } from '@/lib/api';

interface Tenant {
  id: string;
  name: string;
  slug?: string | null;
  city?: string;
  state?: string;
  address?: string;
  pincode?: string;
  gstin?: string;
  drugLicenseNo?: string;
  phone?: string;
  email?: string;
  website?: string;
  portalUrl?: string;
  whatsappPhoneNumberId?: string;
  wabaId?: string;
  hasWhatsappAccessToken?: boolean;
  subscriptionTier: string;
  isActive: boolean;
  allowConsultationBeforePayment?: boolean;
  createdAt: string;
  userCount: number;
  adminEmail?: string;
  adminName?: string;
  adminLastLogin?: string;
}

const TIER_CONFIG: Record<string, { label: string; limit: string; color: string; bg: string }> = {
  BASIC:      { label: 'Tier 1',     limit: '50 users',   color: 'text-gray-600',   bg: 'bg-gray-100'   },
  STANDARD:   { label: 'Tier 2',     limit: '100 users',  color: 'text-blue-700',   bg: 'bg-blue-100'   },
  PREMIUM:    { label: 'Tier 3',     limit: '300 users',  color: 'text-purple-700', bg: 'bg-purple-100' },
  ENTERPRISE: { label: 'Enterprise', limit: 'Unlimited',  color: 'text-amber-700',  bg: 'bg-amber-100'  },
};

const TIERS = [
  { value: 'BASIC',      label: 'Tier 1 — Basic (up to 50 staff)'     },
  { value: 'STANDARD',   label: 'Tier 2 — Standard (up to 100 staff)' },
  { value: 'PREMIUM',    label: 'Tier 3 — Premium (up to 300 staff)'  },
  { value: 'ENTERPRISE', label: 'Enterprise (unlimited)'               },
];

// ── Shared helpers ─────────────────────────────────────────────────────────────

function CredentialBox({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
      <div>
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className={`text-sm font-semibold text-gray-800 ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
      <button
        onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="text-xs text-blue-600 hover:text-blue-800 ml-3 flex-shrink-0">
        {copied ? '✓' : 'Copy'}
      </button>
    </div>
  );
}

const inp = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{children}</p>;
}

// ── Credentials modal ──────────────────────────────────────────────────────────

function buildCredentialHtml(creds: {
  adminName: string;
  email: string;
  password: string;
  tenantSlug?: string;
  tenantId: string;
}, title: string): string {
  const date = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  // Point straight at the hospital's own subdomain — it auto-detects the
  // tenant from the hostname, so staff never have to type a Hospital ID.
  // Falls back to the platform host only for the (non-tenant) admin case.
  const platformDomain = (process.env.NEXT_PUBLIC_PLATFORM_DOMAINS ?? 'megnim.com').split(',')[0].trim();
  const loginUrl = creds.tenantSlug
    ? `https://${creds.tenantSlug}.${platformDomain}/login`
    : `https://app.${platformDomain}/login`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Clinivio Credentials — ${title}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;display:flex;justify-content:center;align-items:flex-start;min-height:100vh;padding:40px 20px}
  .card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.12);width:100%;max-width:480px;overflow:hidden}
  .header{background:linear-gradient(135deg,#4f46e5,#2563eb);padding:24px 28px;color:#fff}
  .logo{display:flex;align-items:center;gap:10px;margin-bottom:14px}
  .logo-icon{width:36px;height:36px;background:rgba(255,255,255,.2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px}
  .logo-text{font-size:18px;font-weight:800;letter-spacing:-.5px}
  .logo-sub{font-size:11px;opacity:.7;margin-top:1px}
  .title{font-size:20px;font-weight:700;margin-bottom:4px}
  .subtitle{font-size:12px;opacity:.75}
  .body{padding:24px 28px}
  .warning{background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:10px 14px;font-size:12px;color:#92400e;margin-bottom:20px;display:flex;gap:8px;align-items:flex-start}
  .warning-icon{font-size:14px;flex-shrink:0;margin-top:1px}
  .slug-box{background:#eff6ff;border:2px solid #93c5fd;border-radius:10px;padding:14px 16px;margin-bottom:16px}
  .slug-label{font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
  .slug-value{font-family:'Courier New',monospace;font-size:22px;font-weight:800;color:#1d4ed8;letter-spacing:1px}
  .slug-note{font-size:11px;color:#60a5fa;margin-top:6px}
  .field{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f1f5f9}
  .field:last-of-type{border-bottom:none}
  .field-label{font-size:12px;color:#64748b;font-weight:500}
  .field-value{font-size:13px;font-weight:600;color:#1e293b;text-align:right;word-break:break-all;max-width:60%}
  .field-value.mono{font-family:'Courier New',monospace;font-size:12px}
  .login-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;margin-top:20px}
  .login-title{font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
  .login-step{font-size:12px;color:#64748b;margin-bottom:4px;display:flex;gap:6px}
  .step-num{background:#2563eb;color:#fff;border-radius:50%;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:1px}
  .url{font-family:'Courier New',monospace;font-size:11px;color:#2563eb;word-break:break-all}
  .footer{padding:14px 28px;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center}
  .footer-note{font-size:11px;color:#94a3b8}
  .confidential{font-size:11px;font-weight:700;color:#ef4444;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:3px 8px}
  @media print{body{background:#fff;padding:0}.card{box-shadow:none;border-radius:0;max-width:100%}}
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="logo">
      <div class="logo-icon">⚕️</div>
      <div>
        <div class="logo-text">Clinivio</div>
        <div class="logo-sub">by Whizzon.ai · Hospital Management</div>
      </div>
    </div>
    <div class="title">${title}</div>
    <div class="subtitle">Generated on ${date}</div>
  </div>
  <div class="body">
    <div class="warning">
      <span class="warning-icon">⚠️</span>
      <span>This document contains sensitive login credentials. Store it securely and do not share via unencrypted channels. Delete after the admin has set a new password.</span>
    </div>

    ${creds.tenantSlug ? `
    <div class="slug-box">
      <div class="slug-label">Hospital ID</div>
      <div class="slug-value">${creds.tenantSlug}</div>
      <div class="slug-note">Already built into the portal link below — no need to type it in.</div>
    </div>` : ''}

    <div class="field">
      <span class="field-label">Admin Name</span>
      <span class="field-value">${creds.adminName}</span>
    </div>
    <div class="field">
      <span class="field-label">Login Email</span>
      <span class="field-value mono">${creds.email}</span>
    </div>
    <div class="field">
      <span class="field-label">Password</span>
      <span class="field-value mono">${creds.password}</span>
    </div>
    <div class="field">
      <span class="field-label">Tenant ID</span>
      <span class="field-value mono" style="font-size:10px">${creds.tenantId}</span>
    </div>

    <div class="login-box">
      <div class="login-title">How to log in</div>
      <div class="login-step"><span class="step-num">1</span><span>Open the Clinivio portal: <span class="url">${loginUrl}</span></span></div>
      ${creds.tenantSlug ? `<div class="login-step"><span class="step-num">2</span><span>Enter Hospital ID: <strong>${creds.tenantSlug}</strong></span></div>` : ''}
      <div class="login-step"><span class="step-num">${creds.tenantSlug ? '3' : '2'}</span><span>Enter email and password above</span></div>
      <div class="login-step"><span class="step-num">${creds.tenantSlug ? '4' : '3'}</span><span>Change password immediately via <strong>Settings → Security</strong></span></div>
    </div>
  </div>
  <div class="footer">
    <span class="footer-note">Clinivio · Powered by Whizzon.ai</span>
    <span class="confidential">CONFIDENTIAL</span>
  </div>
</div>
</body>
</html>`;
}

function CredentialsModal({ creds, title, onClose }: {
  creds: {
    email: string;
    password?: string;
    temporaryPassword?: string;
    tenantId: string;
    tenantSlug?: string;
    adminName: string;
  };
  title: string;
  onClose: () => void;
}) {
  const password = creds.temporaryPassword ?? creds.password ?? '';

  function downloadCredentials() {
    const html = buildCredentialHtml(
      { ...creds, password },
      title,
    );
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `clinivio-credentials-${creds.tenantSlug ?? creds.tenantId.slice(0, 8)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-xl">🔐</div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-green-600 font-medium">Share these credentials securely with the hospital admin</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
            Save these credentials now — the password cannot be retrieved again.
          </div>

          {/* Hospital ID — most important for login, shown first and highlighted */}
          {creds.tenantSlug && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg px-3 py-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-500 font-semibold mb-0.5">Hospital ID <span className="font-normal">(required at login)</span></p>
                  <p className="text-base font-bold text-blue-700 font-mono tracking-wide">{creds.tenantSlug}</p>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(creds.tenantSlug!)}
                  className="text-xs text-blue-600 hover:text-blue-800 ml-3 flex-shrink-0 px-2 py-1 bg-blue-100 rounded-md">
                  Copy
                </button>
              </div>
              <p className="text-xs text-blue-400 mt-1.5">
                Hospital staff enter this in the <span className="font-semibold">Hospital ID</span> field on the login page.
              </p>
            </div>
          )}

          <CredentialBox label="Admin Name"   value={creds.adminName} />
          <CredentialBox label="Login Email"  value={creds.email}     mono />
          <CredentialBox label="Password"     value={password}        mono />
        </div>
        <div className="px-6 pb-5 space-y-2">
          {/* Download button */}
          <button
            onClick={downloadCredentials}
            className="w-full py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Credentials File
          </button>
          <button onClick={onClose}
            className="w-full py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
            Done — I&apos;ve saved these credentials
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Onboard modal ──────────────────────────────────────────────────────────────

function OnboardModal({ onClose, onSuccess }: {
  onClose: () => void;
  onSuccess: (creds: any) => void;
}) {
  const [form, setForm] = useState({
    name: '', slug: '', city: '', state: '', address: '', pincode: '',
    phone: '', email: '', website: '',
    gstin: '', drugLicenseNo: '',
    portalUrl: '', whatsappPhoneNumberId: '', wabaId: '', whatsappAccessToken: '',
    subscriptionTier: 'BASIC',
    adminFirstName: '', adminLastName: '', adminEmail: '', adminPassword: '', adminPhone: '',
  });

  // Auto-generate slug preview from name (used inline in JSX below)
  function previewSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  }
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<{ message: string; details?: string[]; requestId?: string } | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
    let pwd = '';
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    setForm(f => ({ ...f, adminPassword: pwd }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.adminPassword.length < 8) { setError({ message: 'Password must be at least 8 characters' }); return; }
    setSaving(true); setError(null);
    try {
      // NestJS @IsOptional() only skips validation for null/undefined — NOT for
      // empty strings. Strip blank values so optional regex validators (slug,
      // phone, etc.) are not triggered by fields the user left empty.
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== ''),
      );
      const res = await iamApi.post('/tenants', payload);
      onSuccess(res.data.credentials);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string | string[]; errors?: string[]; requestId?: string } } };
      const data = e?.response?.data;
      const msg = data?.message;
      setError({
        message: Array.isArray(msg) ? 'Please fix the following errors' : (msg || 'Failed to onboard hospital'),
        details: Array.isArray(msg) ? msg : (data?.errors ?? undefined),
        requestId: data?.requestId,
      });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold text-gray-900">Onboard New Hospital</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-3 space-y-1.5">
              <p className="text-sm font-semibold text-red-700">{error.message}</p>
              {error.details && error.details.length > 0 && (
                <ul className="list-disc list-inside space-y-0.5">
                  {error.details.map((d, i) => (
                    <li key={i} className="text-xs text-red-600">{d}</li>
                  ))}
                </ul>
              )}
              {error.requestId && (
                <p className="text-xs text-red-400 font-mono pt-0.5">Ref: {error.requestId}</p>
              )}
            </div>
          )}

          {/* Hospital Details */}
          <div>
            <SectionLabel>Hospital Details</SectionLabel>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Hospital Name *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="City General Hospital" className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Hospital ID (slug)
                  <span className="ml-1 font-normal text-gray-400">— staff use this to log in</span>
                </label>
                <input
                  value={form.slug}
                  onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  placeholder="leave blank to auto-generate"
                  className={inp + ' font-mono'}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Lowercase letters, numbers, hyphens only.{' '}
                  {!form.slug && form.name && (
                    <>Will be: <span className="font-mono font-medium text-gray-600">{previewSlug(form.name)}</span></>
                  )}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                  <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Chennai" className={inp} /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                  <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="Tamil Nadu" className={inp} /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="123, Hospital Road" className={inp} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Pincode</label>
                  <input value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })} placeholder="600001" className={inp} /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91-44-12345678" className={inp} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Hospital Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="info@hospital.com" className={inp} /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Website</label>
                  <input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://hospital.com" className={inp} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">GSTIN</label>
                  <input value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value })} placeholder="29ABCDE1234F1Z5" className={inp} /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Drug License No.</label>
                  <input value={form.drugLicenseNo} onChange={e => setForm({ ...form, drugLicenseNo: e.target.value })} placeholder="MH/123456" className={inp} /></div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Portal URL</label>
                <input value={form.portalUrl} onChange={e => setForm({ ...form, portalUrl: e.target.value })}
                  placeholder="greenvalley.megnim.com" className={inp} />
                <p className="text-xs text-gray-400 mt-1">The URL where this hospital accesses Clinivio (optional)</p>
              </div>
            </div>
          </div>

          {/* Subscription Tier */}
          <div>
            <SectionLabel>Subscription Tier</SectionLabel>
            <div className="space-y-2">
              {TIERS.map(t => (
                <label key={t.value}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${form.subscriptionTier === t.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="tier" value={t.value} checked={form.subscriptionTier === t.value}
                    onChange={e => setForm({ ...form, subscriptionTier: e.target.value })} className="text-blue-600" />
                  <span className="text-sm font-medium text-gray-800">{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* WhatsApp Integration */}
          <div>
            <SectionLabel>WhatsApp Integration <span className="normal-case font-normal text-gray-400">(optional)</span></SectionLabel>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp Phone Number ID</label>
                <input value={form.whatsappPhoneNumberId} onChange={e => setForm({ ...form, whatsappPhoneNumberId: e.target.value })}
                  placeholder="Meta Business Phone Number ID" className={inp} /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">WABA ID</label>
                <input value={form.wabaId} onChange={e => setForm({ ...form, wabaId: e.target.value })}
                  placeholder="WhatsApp Business Account ID" className={inp} /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp Access Token</label>
                <input type="password" value={form.whatsappAccessToken} onChange={e => setForm({ ...form, whatsappAccessToken: e.target.value })}
                  placeholder="Leave blank to use the shared platform WhatsApp number" className={inp} /></div>
            </div>
          </div>

          {/* Admin Account */}
          <div>
            <SectionLabel>Admin Account</SectionLabel>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">First Name *</label>
                  <input required value={form.adminFirstName} onChange={e => setForm({ ...form, adminFirstName: e.target.value })} placeholder="Rajesh" className={inp} /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Last Name *</label>
                  <input required value={form.adminLastName} onChange={e => setForm({ ...form, adminLastName: e.target.value })} placeholder="Kumar" className={inp} /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Admin Email *</label>
                <input required type="email" value={form.adminEmail} onChange={e => setForm({ ...form, adminEmail: e.target.value })}
                  placeholder="admin@hospital.com" className={inp} /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Phone *</label>
                <input required value={form.adminPhone} onChange={e => setForm({ ...form, adminPhone: e.target.value })}
                  placeholder="+919876543210" className={inp} /></div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Initial Password *</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input required type={showPwd ? 'text' : 'password'} minLength={8} value={form.adminPassword}
                      onChange={e => setForm({ ...form, adminPassword: e.target.value })}
                      placeholder="Min 8 chars" className={inp + ' pr-14'} />
                    <button type="button" onClick={() => setShowPwd(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                      {showPwd ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <button type="button" onClick={generatePassword}
                    className="px-3 py-2 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                    Generate
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-1 sticky bottom-0 bg-white pb-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving
                ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Onboarding…</>
                : 'Onboard Hospital'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit modal ─────────────────────────────────────────────────────────────────

function EditTenantModal({ tenant, onClose, onSuccess }: {
  tenant: Tenant;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    // Tenant profile
    name:                   tenant.name,
    city:                   tenant.city ?? '',
    state:                  tenant.state ?? '',
    address:                tenant.address ?? '',
    pincode:                tenant.pincode ?? '',
    phone:                  tenant.phone ?? '',
    email:                  tenant.email ?? '',
    website:                tenant.website ?? '',
    gstin:                  tenant.gstin ?? '',
    drugLicenseNo:          tenant.drugLicenseNo ?? '',
    portalUrl:              tenant.portalUrl ?? '',
    whatsappPhoneNumberId:  tenant.whatsappPhoneNumberId ?? '',
    wabaId:                 tenant.wabaId ?? '',
    whatsappAccessToken:    '',
    clearWhatsappConfig:    false,
    subscriptionTier:       tenant.subscriptionTier,
    isActive:               tenant.isActive,
    allowConsultationBeforePayment: tenant.allowConsultationBeforePayment ?? false,
    // Admin credentials (leave blank = no change)
    adminEmail:             tenant.adminEmail ?? '',
    adminFirstName:         '',
    adminLastName:          '',
    adminPhone:             '',
    adminPassword:          '',
  });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<{ message: string; details?: string[]; requestId?: string } | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  // Split admin name into first / last if available
  useEffect(() => {
    if (tenant.adminName) {
      const parts = tenant.adminName.trim().split(' ');
      setForm(f => ({
        ...f,
        adminFirstName: parts.slice(0, -1).join(' ') || parts[0],
        adminLastName:  parts.length > 1 ? parts[parts.length - 1] : '',
      }));
    }
  }, [tenant.adminName]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.adminPassword && form.adminPassword.length < 8) {
      setError({ message: 'New password must be at least 8 characters' }); return;
    }
    setSaving(true); setError(null);

    // Build payload — omit admin password if blank (means "no change")
    const payload: Record<string, unknown> = {
      name: form.name,
      city: form.city || undefined,
      state: form.state || undefined,
      address: form.address || undefined,
      pincode: form.pincode || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      website: form.website || undefined,
      gstin: form.gstin || undefined,
      drugLicenseNo: form.drugLicenseNo || undefined,
      portalUrl: form.portalUrl || undefined,
      whatsappPhoneNumberId: form.whatsappPhoneNumberId || undefined,
      wabaId: form.wabaId || undefined,
      whatsappAccessToken: form.whatsappAccessToken || undefined,
      clearWhatsappConfig: form.clearWhatsappConfig || undefined,
      subscriptionTier: form.subscriptionTier,
      isActive: form.isActive,
      allowConsultationBeforePayment: form.allowConsultationBeforePayment,
      adminEmail: form.adminEmail || undefined,
      adminFirstName: form.adminFirstName || undefined,
      adminLastName: form.adminLastName || undefined,
      adminPhone: form.adminPhone || undefined,
      ...(form.adminPassword ? { adminPassword: form.adminPassword } : {}),
    };

    try {
      await iamApi.patch(`/tenants/${tenant.id}`, payload);
      onSuccess();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string | string[]; errors?: string[]; requestId?: string } } };
      const data = e?.response?.data;
      const msg = data?.message;
      setError({
        message: Array.isArray(msg) ? 'Please fix the following errors' : (msg || 'Save failed'),
        details: Array.isArray(msg) ? msg : (data?.errors ?? undefined),
        requestId: data?.requestId,
      });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Edit — {tenant.name}</h2>
            <p className="text-xs text-gray-400">Changes apply immediately</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-3 space-y-1.5">
              <p className="text-sm font-semibold text-red-700">{error.message}</p>
              {error.details && error.details.length > 0 && (
                <ul className="list-disc list-inside space-y-0.5">
                  {error.details.map((d, i) => (
                    <li key={i} className="text-xs text-red-600">{d}</li>
                  ))}
                </ul>
              )}
              {error.requestId && (
                <p className="text-xs text-red-400 font-mono pt-0.5">Ref: {error.requestId}</p>
              )}
            </div>
          )}

          {/* Hospital Profile */}
          <div>
            <SectionLabel>Hospital Profile</SectionLabel>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Hospital Name *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inp} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                  <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className={inp} /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                  <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} className={inp} /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className={inp} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Pincode</label>
                  <input value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })} className={inp} /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={inp} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Hospital Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inp} /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Website</label>
                  <input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} className={inp} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">GSTIN</label>
                  <input value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value })} className={inp} /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Drug License No.</label>
                  <input value={form.drugLicenseNo} onChange={e => setForm({ ...form, drugLicenseNo: e.target.value })} className={inp} /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Portal URL</label>
                <input value={form.portalUrl} onChange={e => setForm({ ...form, portalUrl: e.target.value })}
                  placeholder="greenvalley.megnim.com" className={inp} /></div>
            </div>
          </div>

          {/* Subscription + Status */}
          <div>
            <SectionLabel>Subscription &amp; Status</SectionLabel>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Subscription Tier</label>
                <select value={form.subscriptionTier} onChange={e => setForm({ ...form, subscriptionTier: e.target.value })} className={inp}>
                  {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded" />
                <span className="text-sm font-medium text-gray-700">Tenant is Active</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.allowConsultationBeforePayment}
                  onChange={e => setForm({ ...form, allowConsultationBeforePayment: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded" />
                <span className="text-sm font-medium text-gray-700">Allow consultation before payment</span>
              </label>
              <p className="text-xs text-gray-400 pl-7 -mt-2">
                Doctors can check in and start a consultation before the fee is paid; the patient pays at the end. Dashboards still flag the visit as payment pending until it&apos;s collected.
              </p>
            </div>
          </div>

          {/* WhatsApp Integration */}
          <div>
            <SectionLabel>WhatsApp Integration</SectionLabel>
            <p className="text-xs text-gray-400 -mt-2 mb-3">
              {tenant.hasWhatsappAccessToken
                ? <span className="text-green-600 font-medium">🔒 This hospital has its own WhatsApp access token configured.</span>
                : 'Not configured — this hospital uses the shared platform WhatsApp number.'}
            </p>
            <fieldset disabled={form.clearWhatsappConfig} className="space-y-3 disabled:opacity-40">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp Phone Number ID</label>
                <input value={form.whatsappPhoneNumberId} onChange={e => setForm({ ...form, whatsappPhoneNumberId: e.target.value })}
                  placeholder="Meta Business Phone Number ID" className={inp} /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">WABA ID</label>
                <input value={form.wabaId} onChange={e => setForm({ ...form, wabaId: e.target.value })}
                  placeholder="WhatsApp Business Account ID" className={inp} /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp Access Token</label>
                <input type="password" value={form.whatsappAccessToken} onChange={e => setForm({ ...form, whatsappAccessToken: e.target.value })}
                  placeholder={tenant.hasWhatsappAccessToken ? 'Leave blank to keep existing token' : 'Leave blank to use the shared platform token'} className={inp} /></div>
            </fieldset>
            <label className="flex items-center gap-3 cursor-pointer mt-3">
              <input type="checkbox" checked={form.clearWhatsappConfig}
                onChange={e => setForm({ ...form, clearWhatsappConfig: e.target.checked })}
                className="w-4 h-4 text-red-600 rounded" />
              <span className="text-sm font-medium text-gray-700">Remove WhatsApp configuration</span>
            </label>
            <p className="text-xs text-gray-400 pl-7 -mt-1">
              Clears the phone number ID, WABA ID and access token above, reverting this hospital to the shared platform WhatsApp number.
            </p>
          </div>

          {/* Admin Account */}
          <div>
            <SectionLabel>Admin Account</SectionLabel>
            <p className="text-xs text-gray-400 -mt-2 mb-3">Leave Password blank to keep it unchanged.</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
                  <input value={form.adminFirstName} onChange={e => setForm({ ...form, adminFirstName: e.target.value })} className={inp} /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
                  <input value={form.adminLastName} onChange={e => setForm({ ...form, adminLastName: e.target.value })} className={inp} /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Admin Email</label>
                <input type="email" value={form.adminEmail} onChange={e => setForm({ ...form, adminEmail: e.target.value })} className={inp} /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Admin Phone</label>
                <input value={form.adminPhone} onChange={e => setForm({ ...form, adminPhone: e.target.value })}
                  placeholder="+919876543210" className={inp} /></div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">New Password <span className="text-gray-400">(blank = no change)</span></label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} value={form.adminPassword}
                    onChange={e => setForm({ ...form, adminPassword: e.target.value })}
                    placeholder="Leave blank to keep current password" className={inp + ' pr-14'} />
                  <button type="button" onClick={() => setShowPwd(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                    {showPwd ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-1 sticky bottom-0 bg-white pb-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving
                ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving…</>
                : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete confirmation modal ──────────────────────────────────────────────────

function DeleteConfirmModal({ tenant, onClose, onConfirm, deleting }: {
  tenant: Tenant;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  const [confirmed, setConfirmed] = useState('');
  const match = tenant.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-xl">🗑️</div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Delete {tenant.name}?</h2>
            <p className="text-xs text-red-600 font-medium">This action cannot be undone</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 space-y-1">
            <p className="font-semibold">This will permanently:</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>Delete all patient records, appointments, and clinical data</li>
              <li>Remove the hospital&apos;s admin account</li>
              <li>Remove the tenant record from the platform</li>
            </ul>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Type <span className="font-mono font-semibold text-gray-800">{match}</span> to confirm
            </label>
            <input
              value={confirmed}
              onChange={e => setConfirmed(e.target.value)}
              placeholder={match}
              className={inp}
              autoFocus
            />
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmed !== match || deleting}
            className="flex-1 py-2 text-sm bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-40 flex items-center justify-center gap-2">
            {deleting
              ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Deleting…</>
              : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────

const KeyIcon   = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>;
const EditIcon  = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
const TrashIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;

// ── Modal state type ───────────────────────────────────────────────────────────

type ModalState =
  | { type: 'onboard' }
  | { type: 'credentials'; creds: any; title: string }
  | { type: 'edit'; tenant: Tenant }
  | { type: 'delete'; tenant: Tenant }
  | null;

// ── Page ───────────────────────────────────────────────────────────────────────

export default function HospitalsPage() {
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState<ModalState>(null);
  const [toast, setToast]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [resetting, setResetting]   = useState<string | null>(null);
  const [deleting, setDeleting]     = useState(false);

  // Filter out the platform tenant (no slug) — it's not a hospital
  const tenants = allTenants.filter(t => t.slug);

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      const res = await iamApi.get('/tenants');
      setAllTenants(res.data || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleResetPassword(tenant: Tenant) {
    setResetting(tenant.id);
    try {
      const res = await iamApi.post(`/tenants/${tenant.id}/reset-admin-password`);
      setModal({
        type: 'credentials',
        creds: {
          ...res.data,
          tenantId:   tenant.id,
          tenantSlug: res.data.tenantSlug ?? tenant.slug ?? undefined,
        },
        title: `New Credentials — ${tenant.name}`,
      });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      showToast(e?.response?.data?.message || 'Failed to reset password', 'error');
    } finally { setResetting(null); }
  }

  async function handleDeleteConfirm() {
    if (modal?.type !== 'delete') return;
    setDeleting(true);
    try {
      await iamApi.delete(`/tenants/${modal.tenant.id}`);
      setModal(null);
      showToast(`${modal.tenant.name} has been permanently deleted`);
      fetchTenants();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      showToast(e?.response?.data?.message || 'Failed to delete tenant', 'error');
      setModal(null);
    } finally { setDeleting(false); }
  }

  return (
    <div>
      {/* Modals */}
      {modal?.type === 'onboard' && (
        <OnboardModal
          onClose={() => setModal(null)}
          onSuccess={creds => setModal({ type: 'credentials', creds, title: 'Hospital Onboarded 🎉' })}
        />
      )}
      {modal?.type === 'credentials' && (
        <CredentialsModal
          creds={modal.creds} title={modal.title}
          onClose={() => { setModal(null); fetchTenants(); showToast('Hospital onboarded successfully!'); }}
        />
      )}
      {modal?.type === 'edit' && (
        <EditTenantModal
          tenant={modal.tenant}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); fetchTenants(); showToast('Hospital updated successfully!'); }}
        />
      )}
      {modal?.type === 'delete' && (
        <DeleteConfirmModal
          tenant={modal.tenant}
          onClose={() => setModal(null)}
          onConfirm={handleDeleteConfirm}
          deleting={deleting}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Hospitals</h1>
          <p className="text-sm text-gray-500">
            {loading ? 'Loading…' : `${tenants.length} hospital${tenants.length !== 1 ? 's' : ''} onboarded`}
          </p>
        </div>
        <button
          onClick={() => setModal({ type: 'onboard' })}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
          + Onboard Hospital
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mb-4 border text-sm rounded-lg px-4 py-2.5 flex items-center gap-2 ${
          toast.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          <span>{toast.type === 'error' ? '✗' : '✓'}</span> {toast.msg}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Hospital</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Admin</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Tier</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Staff</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Last Login</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <div className="text-4xl">🏥</div>
                      <p className="font-medium text-gray-500">No hospitals onboarded yet</p>
                      <button onClick={() => setModal({ type: 'onboard' })}
                        className="text-sm text-blue-600 hover:underline">
                        Onboard your first hospital →
                      </button>
                    </div>
                  </td>
                </tr>
              ) : tenants.map((t, i) => {
                const tier       = TIER_CONFIG[t.subscriptionTier] ?? TIER_CONFIG.BASIC;
                const tierLimit  = { BASIC: 50, STANDARD: 100, PREMIUM: 300, ENTERPRISE: Infinity }[t.subscriptionTier] ?? 50;
                const usage      = tierLimit === Infinity ? `${t.userCount}` : `${t.userCount} / ${tierLimit}`;
                const pct        = tierLimit === Infinity ? 0 : Math.min(100, Math.round((t.userCount / tierLimit) * 100));
                const isLast     = i === tenants.length - 1;

                return (
                  <tr key={t.id} className={`hover:bg-gray-50 ${isLast ? '' : 'border-b border-gray-50'}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-400">{[t.city, t.state].filter(Boolean).join(', ') || '—'}</p>
                      {t.slug && (
                        <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded text-xs font-mono text-indigo-600"
                          title="Hospital ID — staff use this to log in">
                          🔑 {t.slug}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{t.adminName ?? '—'}</p>
                      <p className="text-xs text-gray-400 font-mono">{t.adminEmail ?? ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tier.bg} ${tier.color}`}>{tier.label}</span>
                      <p className="text-xs text-gray-400 mt-0.5">{tier.limit}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-800">{usage}</p>
                      {tierLimit < Infinity && (
                        <div className="w-20 h-1.5 bg-gray-200 rounded-full mt-1">
                          <div
                            className={`h-1.5 rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${t.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {t.adminLastLogin
                        ? new Date(t.adminLastLogin).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Reset password */}
                        <button
                          onClick={() => handleResetPassword(t)}
                          disabled={resetting === t.id}
                          title="Reset admin password"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-amber-500 hover:bg-amber-50 disabled:opacity-50 transition-colors">
                          {resetting === t.id
                            ? <span className="w-3.5 h-3.5 border border-amber-400 border-t-amber-700 rounded-full animate-spin" />
                            : <KeyIcon />}
                        </button>
                        {/* Edit */}
                        <button
                          onClick={() => setModal({ type: 'edit', tenant: t })}
                          title="Edit hospital"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-blue-500 hover:bg-blue-50 transition-colors">
                          <EditIcon />
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => setModal({ type: 'delete', tenant: t })}
                          title="Delete hospital"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 transition-colors">
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
