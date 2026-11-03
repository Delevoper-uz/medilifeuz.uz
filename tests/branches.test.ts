import { expect, test } from "bun:test";
import { BRANCHES, branchOrderCallback, coordinatesFromYandexUrl, haversineKm, nearestBranch, type Branch } from "../src/lib/branches";

test("haversine: Toshkent–Namangan taxminan 220 km", () => {
  const km = haversineKm(41.2995, 69.2401, 40.9983, 71.6726);
  expect(km).toBeGreaterThan(195);
  expect(km).toBeLessThan(215);
});

test("only entered branches participate; unentered 2-Filial is never selected", () => {
  const branches: Branch[] = [
    { id: 'one', name: '1-Filial', latitude: 40.9983, longitude: 71.6726, telegram_chat_id: null },
    { id: 'four', name: '4-Filial', latitude: 41.0021, longitude: 71.7105, telegram_chat_id: '-1004' },
  ];
  expect(nearestBranch(41.0105, 71.6431, branches)?.branch.id).toBe('one');
  expect(nearestBranch(41.0021, 71.7105, branches)?.branch.telegram_chat_id).toBe('-1004');
});

test("no invented fallback locations", () => {
  expect(BRANCHES.length).toBe(0);
  expect(nearestBranch(41, 71, [])).toBeNull();
});

test('configured branch buttons fit Telegram 64-byte limit and retain exact ids', () => {
  const branch = '12345678-abcd-1234-abcd-123456789012';
  const order = '87654321-abcd-1234-abcd-123456789012';
  const value = branchOrderCallback(branch, order);
  expect(new TextEncoder().encode(value).length).toBeLessThanOrEqual(64);
  expect(Buffer.from(value.split(':')[1], 'base64url').toString('hex')).toBe(branch.replace(/-/g, ''));
  expect(value.split(':')[2]).toBe(order.replace(/-/g, ''));
});

test("Yandex pin longitude-latitude is converted and preferred over viewport", () => {
  expect(coordinatesFromYandexUrl('https://yandex.uz/maps/?ll=70,40&pt=71.7105,41.0021')).toEqual([41.0021, 71.7105]);
  expect(coordinatesFromYandexUrl('https://yandex.ru/maps/?whatshere%5Bpoint%5D=71.6726,40.9983')).toEqual([40.9983, 71.6726]);
  expect(coordinatesFromYandexUrl('https://example.com/maps/?pt=71,41')).toBeNull();
  expect(coordinatesFromYandexUrl('https://yandex.ru/maps/?pt=71,999')).toBeNull();
});
