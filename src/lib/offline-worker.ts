import { refuseOfflineWorker } from './offline-policy';

export async function registerOfflineWorker() {
  if (!('serviceWorker' in navigator)) return;
  const refused = refuseOfflineWorker(import.meta.env.PROD, window.self !== window.top, window.location.hostname, new URLSearchParams(window.location.search).get('sw') === 'off');
  if (refused) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.filter(r => [r.active, r.waiting, r.installing].some(w => w && new URL(w.scriptURL).pathname === '/sw.js')).map(r => r.unregister()));
    return;
  }
  const registration = await navigator.serviceWorker.register('/sw.js');
  void registration.update().catch(() => undefined);
  await navigator.serviceWorker.ready;
  // Cache the server-rendered catalogue entry after installation, even when opening the home page first.
  try {
    const response = await fetch('/dorilar', { credentials: 'omit' });
    if (response.ok) await (await caches.open('medilife-pages')).put(new URL('/dorilar', location.origin).href, response);
  } catch { /* The previous catalogue entry remains available. */ }
}