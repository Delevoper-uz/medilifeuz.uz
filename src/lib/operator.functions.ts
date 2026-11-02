import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import type { OperatorMedicine } from "./operator-model";
const keySchema = z.object({ id: z.string().uuid(), secret: z.string().min(64).max(100) });
export const pollOperatorRequest = createServerFn({ method: "POST" })
  .inputValidator((input) => keySchema.parse(input))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { hashCapability } = await import("./operator.server");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await db.from("operator_requests").select("status,selected").eq("id", data.id).eq("secret_hash", hashCapability(data.secret)).maybeSingle();
    if (error) throw new Error("Xabarni tekshirish imkoni bo‘lmadi");
    if (!row) throw new Error("So‘rov topilmadi");
    return { status: row.status, items: row.status === "sent" ? row.selected as unknown as OperatorMedicine[] : [] };
  });