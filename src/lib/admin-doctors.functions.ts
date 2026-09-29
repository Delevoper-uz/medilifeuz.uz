import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminPanel } from "@/lib/admin-middleware";

type AnyDb = { from: (t: string) => any };
async function db(): Promise<AnyDb> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AnyDb;
}

const DoctorSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(180),
  specialty: z.string().max(180).nullable().optional(),
  image_url: z.string().max(1500).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  branch: z.string().max(180).nullable().optional(),
  schedule: z.string().max(300).nullable().optional(),
});

export const adminListDoctors = createServerFn({ method: "POST" })
  .middleware([requireAdminPanel])
  .inputValidator((i) => i ?? {})
  .handler(async () => {
    const { data, error } = await (await db()).from("doctors").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

export const adminSaveDoctor = createServerFn({ method: "POST" })
  .middleware([requireAdminPanel])
  .inputValidator((i) => DoctorSchema.parse(i))
  .handler(async ({ data }) => {
    const { id, ...rest } = data;
    const payload = {
      name: rest.name,
      specialty: rest.specialty || null,
      image_url: rest.image_url || null,
      phone: rest.phone || null,
      branch: rest.branch || null,
      schedule: rest.schedule || null,
    };
    const d = await db();
    const { error } = id ? await d.from("doctors").update(payload).eq("id", id) : await d.from("doctors").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteDoctor = createServerFn({ method: "POST" })
  .middleware([requireAdminPanel])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { error } = await (await db()).from("doctors").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListAppointments = createServerFn({ method: "POST" })
  .middleware([requireAdminPanel])
  .inputValidator((i) => i ?? {})
  .handler(async () => {
    const { data, error } = await (await db())
      .from("doctor_appointments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

export const adminSetAppointmentStatus = createServerFn({ method: "POST" })
  .middleware([requireAdminPanel])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), status: z.enum(["pending", "confirmed", "done", "cancelled"]) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { error } = await (await db()).from("doctor_appointments").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
