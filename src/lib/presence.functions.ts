import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminPanel } from "@/lib/admin-middleware";

const HeartbeatSchema = z.object({
  path: z.string().max(200),
  activity: z.string().max(120),
  phone_number: z.string().max(30).optional().nullable(),
  full_name: z.string().max(120).optional().nullable(),
});

/** Akkaunt tizimi o'chirilgani uchun faoliyat yozuvi saqlanmaydi. */
export const presenceHeartbeat = createServerFn({ method: "POST" })
  .inputValidator((i) => HeartbeatSchema.parse(i))
  .handler(async () => ({ ok: true }));

export const adminListPresence = createServerFn({ method: "POST" })
  .middleware([requireAdminPanel])
  .inputValidator((i) => (i ?? {}))
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("user_presence")
      .select("user_id, phone_number, full_name, activity, path, last_seen_at")
      .order("last_seen_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
