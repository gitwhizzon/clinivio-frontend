/**
 * Client-side mirror of the backend's TenantContextMiddleware.extractSlug().
 * Keep the two in sync — see apps/api/src/middleware/tenant-context.middleware.ts.
 *
 *   app.megnim.com        → platform (super admin, no tenant)
 *   hansvl.megnim.com     → tenant "hansvl"
 *   localhost / *.vercel.app / *.onrender.com → unknown (no real subdomain to read)
 *
 * The frontend and API live on different hosts (browser: hansvl.megnim.com,
 * API: api.megnim.com or a Render URL), so the API can't read the tenant off
 * its own Host header for browser-originated requests — the slug detected
 * here is sent instead as the X-Tenant-Slug header (see lib/api.ts).
 */

const PLATFORM_SUBDOMAINS = new Set(['www', 'admin', 'api', 'app']);

function getPlatformDomains(): string[] {
  return (process.env.NEXT_PUBLIC_PLATFORM_DOMAINS ?? 'clinivio.ai,whizzon.ai')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export type HostContext =
  | { kind: 'tenant'; slug: string }
  | { kind: 'platform' }
  // localhost, a Vercel preview URL, the Render direct URL — no subdomain to
  // trust. Callers should fall back to letting the user type a slug in.
  | { kind: 'unknown' };

export function resolveHostContext(hostname?: string): HostContext {
  const host = (
    hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')
  ).toLowerCase();

  if (!host) return { kind: 'unknown' };

  const platformDomains = getPlatformDomains();
  const parts = host.split('.');

  if (parts.length < 3) {
    // Bare base domain (e.g. "megnim.com") or something like "localhost"
    return platformDomains.includes(host) ? { kind: 'platform' } : { kind: 'unknown' };
  }

  const baseDomain = parts.slice(-2).join('.');
  const subdomain = parts[0];

  if (!platformDomains.includes(baseDomain)) {
    return { kind: 'unknown' };
  }

  if (PLATFORM_SUBDOMAINS.has(subdomain)) {
    return { kind: 'platform' };
  }

  return { kind: 'tenant', slug: subdomain };
}
