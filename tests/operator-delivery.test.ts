import { expect, test } from "bun:test";
import { CATALOG_SEARCH_CAPACITY, OPERATOR_NOTICE_MS, SEARCH_PAGE_SIZE, mergeOperatorItems, cartEntryKey, type BasketEntry } from "../src/lib/operator-model";
test("supports a 400000 medicine catalogue without loading it all", () => {
  expect(CATALOG_SEARCH_CAPACITY).toBe(400000);
  expect(Math.ceil(CATALOG_SEARCH_CAPACITY / SEARCH_PAGE_SIZE)).toBe(4000);
});
test("notification remains for seven seconds", () => expect(OPERATOR_NOTICE_MS).toBe(7000));
const medicine = { id: "medicine-1", name: "Telsartan A", price: 12000, image_url: null, unit: "dona" };
const customer: BasketEntry = { ...medicine, quantity: 2 };
test("operator selections preserve customer medicines even for the same medicine", () => {
  const result = mergeOperatorItems([customer], [medicine], "request-1");
  expect(result).toHaveLength(2);
  expect(result[0]?.quantity).toBe(2);
  expect(result[1]?.source).toBe("operator");
  expect(cartEntryKey(result[0] as BasketEntry)).not.toBe(cartEntryKey(result[1] as BasketEntry));
});
test("delivery retries do not duplicate medicines", () => {
  const once = mergeOperatorItems([], [medicine, medicine], "request-1");
  expect(once).toHaveLength(1);
  expect(mergeOperatorItems(once, [medicine], "request-1")).toEqual(once);
});
test("empty operator lists do not create an operator cart section", () => {
  expect(mergeOperatorItems([customer], [], "empty").filter(i => i.source === "operator")).toHaveLength(0);
});