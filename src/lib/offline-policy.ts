export function refuseOfflineWorker(production: boolean, framed: boolean, hostname: string, disabled: boolean) {
  const host = hostname.toLowerCase();
  const lovableHost = /\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(host);
  const label = host.split('.')[0] ?? '';
  return !production || framed || disabled ||
    (lovableHost && (/^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(label) || /^project--.+-dev$/.test(label))) ||
    /(^|\.)(lovableproject\.com|lovableproject-dev\.com|beta\.lovable\.dev)$/.test(host);
}
export function blockOfflineRefresh(key: string, code: string, ctrl: boolean, meta: boolean) {
  return key === 'F5' || ((ctrl || meta) && (key.toLowerCase() === 'r' || code === 'KeyR'));
}