import { expect, test } from "bun:test";
import { BRANCHES, haversineKm, nearestBranch } from "../src/lib/branches";

test("haversine: Toshkent–Namangan taxminan 220 km", () => {
  const km = haversineKm(41.2995, 69.2401, 40.9983, 71.6726);
  expect(km).toBeGreaterThan(195);
  expect(km).toBeLessThan(215);
});

test("eng yaqin filial: filial ustidagi nuqta o'sha filialni tanlaydi", () => {
  for (const b of BRANCHES) expect(nearestBranch(b.latitude, b.longitude).branch.id).toBe(b.id);
});

test("5 ta filial bor", () => expect(BRANCHES.length).toBe(5));
