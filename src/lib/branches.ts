// Only persisted, configured locations participate in order routing.
export type Branch = { id: string; name: string; latitude: number; longitude: number; telegram_chat_id: string | null };

export const BRANCHES: Branch[] = [];

export function isValidCoordinates(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function isYandexMapUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port &&
      /^(?:www\.)?yandex\.(?:ru|uz|com)$/.test(u.hostname) && /^\/maps(?:\/|$)/.test(u.pathname);
  } catch { return false; }
}

export function coordinatesFromYandexUrl(value: string): [number, number] | null {
  if (!isYandexMapUrl(value)) return null;
  const params = new URL(value).searchParams;
  // A pin takes priority over the viewport center.
  const point = params.get('pt') ?? params.get('whatshere[point]') ?? params.get('ll');
  if (!point) return null;
  const pair = point.split('~')[0].split(',');
  if (pair.length < 2 || !pair[0].trim() || !pair[1].trim()) return null;
  const lng = Number(pair[0]), lat = Number(pair[1]);
  return isValidCoordinates(lat, lng) ? [lat, lng] : null;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function nearestBranch(lat: number, lon: number, branches: Branch[] = BRANCHES) {
  if (!isValidCoordinates(lat, lon)) return null;
  let best: Branch | undefined;
  let bestKm = Infinity;
  for (const b of branches) {
    if (!isValidCoordinates(b.latitude, b.longitude)) continue;
    const km = haversineKm(lat, lon, b.latitude, b.longitude);
    if (km < bestKm) { best = b; bestKm = km; }
  }
  return best ? { branch: best, km: bestKm } : null;
}
