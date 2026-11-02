import { expect, test } from "bun:test";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
test.skipIf(!url || !key)("operator claim, numbered removal and one-at-a-time undo are isolated", async () => {
  if (!url || !key) return;
  const db = createClient(url, key, { auth: { persistSession: false }, global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith("sb_")) headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  } } });
  const id = randomUUID();
  const medicines = [{ id: "one", name: "Ekvator", price: 10000 }, { id: "two", name: "Telsartan A", price: 20000 }, { id: "three", name: "Paratsetamol", price: 3000 }];
  const { error } = await db.from("operator_requests").insert({ id, secret_hash: createHash("sha256").update(randomUUID()).digest("hex"), chat_id: -1 });
  expect(error).toBeNull();
  const action = async (name: string, value: unknown = null, operator = 100) => db.rpc("operator_request_action", { p_id: id, p_operator: operator, p_action: name, p_value: value });
  try {
    expect((await action("claim")).error).toBeNull();
    expect((await action("claim", null, 200)).error).not.toBeNull();
    await action("candidates", medicines);
    await action("pick", 1); await action("pick", 2); await action("pick", 3);
    await action("delete", 2); await action("delete", 1);
    const first = await action("undo");
    expect(first.data.selected.map((m: { id: string }) => m.id)).toEqual(["one", "three"]);
    const second = await action("undo");
    expect(second.data.selected.map((m: { id: string }) => m.id)).toEqual(["one", "two", "three"]);
    await action("preview");
    expect((await action("send")).data.status).toBe("sent");
  } finally { await db.from("operator_requests").delete().eq("id", id); }
});