import type { Medicine } from '@/components/MedicineCard';

export const RANDOM_BATCH_SIZE = 20;
export function medicineKey(m: Medicine) {
  return `${(m.name_cyrl || m.name).toLowerCase().replace(/\s+/g, ' ').trim()}|${m.price}`;
}
export function pickMedicineBatch(pool: Medicine[], previous: Medicine[], random = Math.random): Medicine[] {
  const seen = new Set(previous.map(medicineKey));
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j] as Medicine, shuffled[i] as Medicine];
  }
  return shuffled.filter(m => {
    const key = medicineKey(m);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, RANDOM_BATCH_SIZE);
}