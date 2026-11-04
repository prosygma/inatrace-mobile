export function normalizeServerUrl(value: string, allowHttp = __DEV__, allowExistingHttp = false): string {
  const input = value.trim();
  if (!input) throw new Error('empty');
  let url: URL;
  try { url = new URL(input); } catch { throw new Error('invalid'); }
  const localHttp = allowHttp && url.protocol === 'http:' &&
    (allowExistingHttp || ['localhost', '127.0.0.1', '10.0.2.2', '[::1]'].includes(url.hostname.toLowerCase()));
  if ((url.protocol !== 'https:' && !localHttp) ||
      !url.hostname || url.username || url.password || url.search || url.hash) {
    throw new Error('invalid');
  }
  const port = url.port ? `:${url.port}` : '';
  return `${url.protocol}//${url.hostname.toLowerCase()}${port}` +
    (url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, ''));
}

export function isCompatibleOpenApi(value: any): boolean {
  return typeof value?.openapi === 'string' &&
    Boolean(value?.paths?.['/api/user/login']?.post) &&
    Boolean(value?.paths?.['/api/user/profile']?.get);
}

export function isCompatiblePublicResponse(value: any): boolean {
  return value?.status === 'OK' && value.data !== null &&
    typeof value.data === 'object' && !Array.isArray(value.data);
}

export function isCompatibleLoginProbe(value: any): boolean {
  return value?.status === 'ERROR' &&
    value?.errorMessage === "Request method 'GET' is not supported";
}

// Cameroon tenants are reached by a short company code (e.g. "ccq"), which expands to the
// domains we host on. A full address is returned unchanged so normalizeServerUrl can check it.
const COMPANY_CODE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const COMPANY_CODE_DOMAINS = ['inatrace.cm', 'cm', 'com'];

export function serverCandidates(value: string): string[] {
  const input = value.trim().toLowerCase();
  if (!COMPANY_CODE.test(input)) return [value];
  return COMPANY_CODE_DOMAINS.map(domain => `https://${input}.${domain}`);
}
