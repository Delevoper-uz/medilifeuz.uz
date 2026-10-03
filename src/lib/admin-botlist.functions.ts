import { createServerFn } from "@tanstack/react-start";
import { requireAdminPanel } from "@/lib/admin-middleware";

/** Telegram guruhdan oxirgi kelgan (tanlangan) dorilar ro'yxati — faqat admin uchun. */
export const adminLatestBotList = createServerFn({ method: "GET" })
  .middleware([requireAdminPanel])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("bot_shared_lists")
      .select("id, names, created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    const row = data?.[0];
    if (!row) return null;
    const names: string[] = row.names ?? [];
    const { data: meds } = names.length
      ? await supabaseAdmin.from("medicines").select("id, name, name_cyrl, price").in("name", names).limit(100)
      : { data: [] as { id: string; name: string; name_cyrl: string | null; price: number }[] };
    const items = names.map((n) => {
      const m = (meds ?? []).find((x) => x.name === n);
      return { name: n, name_cyrl: m?.name_cyrl ?? null, price: m ? Number(m.price) : null };
    });
    return { id: row.id as string, created_at: row.created_at as string, items };
  });
