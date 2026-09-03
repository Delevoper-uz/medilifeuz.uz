import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminPanel } from "@/lib/admin-middleware";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const HeartbeatSchema = z.object({
  path: z.string().max(200),
  activity: z.string().max(120),
  phone_number: z.string().max(30).optional().nullable(),
  full_name: z.string().max(120).optional().nullable(),
});

export const presenceHeartbeat = createServerFn({ method: "POST" })
  .middleware([requireAdminPanel])
  .inputValidator((i) => HeartbeatSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_presence").upsert(
      {
        user_id: context.userId,
        path: data.path,
        activity: data.activity,
        phone_number: data.phone_number ?? null,
        full_name: data.full_name ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) return { ok: false };
    return { ok: true };
  });

export const adminListPresence = createServerFn({ method: "POST" })
  .middleware([requireAdminPanel])
  .inputValidator((i) => (i ?? {}))
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: role, error: rerr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (rerr) throw new Error("Auth check failed");
    if (!role) throw new Error("Forbidden: admin role required");

    const { data, error } = await supabaseAdmin
      .from("user_presence")
      .select("user_id, phone_number, full_name, activity, path, last_seen_at")
      .order("last_seen_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
