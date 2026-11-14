import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminPanel } from "@/lib/admin-middleware";

const Key = z.object({ location: z.enum(["header", "query"]), name: z.string().max(100), value: z.string().max(2000) });
const Settings = z.object({
  source_url: z.string().url().max(1000).nullable(),
  http_method: z.enum(["GET", "POST"]),
  keys: z.array(Key).max(20),
  name_column: z.string().max(100).nullable(), name_col_index: z.number().int().min(1).max(500).nullable(),
  stock_column: z.string().max(100).nullable(), stock_col_index: z.number().int().min(1).max(500).nullable(),
  price_column: z.string().max(100).nullable(), price_col_index: z.number().int().min(1).max(500).nullable(),
  header_row: z.number().int().min(1).max(1000),
  interval_minutes: z.number().int().min(15).max(60 * 24 * 60),
  enabled: z.boolean(),
});

/** Kalit qiymatlari brauzerga qaytarilmaydi, faqat "saqlangan" belgisi. */
export const getPriceSync = createServerFn({ method: "POST" })
  .middleware([requireAdminPanel])
  .handler(async () => {
    const { loadSettings } = await import("./price-sync.server");
    const s = await loadSettings();
    if (!s) return null;
    return { ...s, keys: (s.keys ?? []).map((k) => ({ ...k, value: "", saved: !!k.value })) };
  });

export const savePriceSync = createServerFn({ method: "POST" })
  .middleware([requireAdminPanel])
  .inputValidator((i) => Settings.parse(i))
  .handler(async ({ data }) => {
    const { loadSettings } = await import("./price-sync.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const old = await loadSettings();
    const oldKeys = old?.keys ?? [];
    const keys = data.keys.filter((k) => k.name.trim()).map((k) => ({
      ...k, name: k.name.trim(),
      value: k.value || oldKeys.find((o) => o.name === k.name.trim() && o.location === k.location)?.value || "",
    }));
    const { error } = await supabaseAdmin.from("price_sync_settings").upsert({ id: 1, ...data, keys, updated_at: new Date().toISOString() } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runPriceSyncNow = createServerFn({ method: "POST" })
  .middleware([requireAdminPanel])
  .handler(async () => {
    const { runPriceSync } = await import("./price-sync.server");
    return { status: await runPriceSync() };
  });
