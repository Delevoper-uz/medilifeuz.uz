export const OPERATOR_NOTICE_MS = 7000;
export const CATALOG_SEARCH_CAPACITY = 400000;
export const SEARCH_PAGE_SIZE = 100;
export type OperatorMedicine = { id: string; name: string; name_cyrl?: string | null; price: number; image_url: string | null; unit?: string };
export type DeliveryKey = { id: string; secret: string };
export type BasketEntry = OperatorMedicine & { quantity: number; unit: string; source?: "customer" | "operator"; requestId?: string };
export function mergeOperatorItems(items: BasketEntry[], medicines: OperatorMedicine[], requestId: string): BasketEntry[] {
  if (items.some((item) => item.requestId === requestId)) return items;
  const seen = new Set<string>();
  return [...items, ...medicines.filter((m) => { if (seen.has(m.id)) return false; seen.add(m.id); return true; }).map((m) => ({ ...m, price: Number(m.price), unit: m.unit || "dona", quantity: 1, source: "operator" as const, requestId }))];
}
export function cartEntryKey(item: BasketEntry) { return `${item.source ?? "customer"}:${item.requestId ?? ""}:${item.id}`; }