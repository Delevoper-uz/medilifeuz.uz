import { expect, test } from 'bun:test';
import { pickMedicineBatch } from '../src/lib/random-medicines';
import type { Medicine } from '../src/components/MedicineCard';
const rows: Medicine[] = Array.from({ length: 60 }, (_, i) => ({ id: String(i), name: `Dori ${i}`, price: i, unit: 'dona', stock: 0, description: null, image_url: null }));
test('initial random batch contains exactly 20 medicines', () => {
  expect(pickMedicineBatch(rows, [], () => 0.5)).toHaveLength(20);
});
test('next click appends 20 medicines without repeating previous selections', () => {
  const first = pickMedicineBatch(rows, [], () => 0.5);
  const next = pickMedicineBatch(rows, first, () => 0.3);
  expect(next).toHaveLength(20);
  expect(new Set([...first, ...next].map(m => m.id)).size).toBe(40);
});
test('duplicate Excel entries are not repeated within a batch', () => {
  expect(pickMedicineBatch([...rows, ...rows], [], () => 0.5).map(m => m.id)).toHaveLength(20);
  expect(new Set(pickMedicineBatch([...rows, ...rows], [], () => 0.5).map(m => m.id)).size).toBe(20);
});