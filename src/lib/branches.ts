// Filiallar koordinatalari (taxminiy, Namangan). Haqiqiy koordinatalar bilan almashtiring.
// telegram_chat_id null bo'lsa buyurtma asosiy guruhga boradi.
export type Branch = { id: number; name: string; latitude: number; longitude: number; telegram_chat_id: string | null };

export const BRANCHES: Branch[] = [
  { id: 1, name: "1-Filial", latitude: 40.9983, longitude: 71.6726, telegram_chat_id: null },
  { id: 2, name: "2-Filial", latitude: 41.0105, longitude: 71.6431, telegram_chat_id: null },
  { id: 3, name: "3-Filial", latitude: 40.9852, longitude: 71.6012, telegram_chat_id: null },
  { id: 4, name: "4-Filial", latitude: 41.0021, longitude: 71.7105, telegram_chat_id: null },
  { id: 5, name: "5-Filial", latitude: 40.9718, longitude: 71.6550, telegram_chat_id: null },
];

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function nearestBranch(lat: number, lon: number, branches: Branch[] = BRANCHES) {
  let best = branches[0];
  let bestKm = Infinity;
  for (const b of branches) {
    const km = haversineKm(lat, lon, b.latitude, b.longitude);
    if (km < bestKm) { best = b; bestKm = km; }
  }
  return { branch: best, km: bestKm };
}
