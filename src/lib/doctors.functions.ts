import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export type Doctor = {
  id: string;
  name: string;
  specialty: string | null;
  image_url: string | null;
  phone: string | null;
  branch: string | null;
  schedule: string | null;
};

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Saytda ko'rsatiladigan doktorlar ro'yxati. */
export const listDoctors = createServerFn({ method: "GET" }).handler(async (): Promise<Doctor[]> => {
  const { data } = await publicClient()
    .from("doctors")
    .select("id, name, specialty, image_url, phone, branch, schedule")
    .order("created_at", { ascending: false });
  return (data ?? []) as Doctor[];
});

const BookSchema = z.object({
  doctor_id: z.string().uuid(),
  doctor_name: z.string().min(1).max(180),
  customer_name: z.string().trim().min(2).max(120),
  customer_phone: z.string().trim().min(7).max(25),
});

/** Doktor ko'rigiga yozilish — bazaga yozadi va Telegram guruhga yuboradi. */
export const bookAppointment = createServerFn({ method: "POST" })
  .inputValidator((i) => BookSchema.parse(i))
  .handler(async ({ data }) => {
    const digits = data.customer_phone.replace(/\D/g, "");
    if (digits.length !== 12 || !digits.startsWith("998")) {
      throw new Error("Telefon raqam +998 bilan boshlanishi kerak");
    }
    const phone = `+${digits}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as unknown as { from: (t: string) => any })
      .from("doctor_appointments")
      .insert({
        doctor_id: data.doctor_id,
        doctor_name: data.doctor_name,
        customer_name: data.customer_name,
        customer_phone: phone,
      });
    if (error) throw new Error("Saqlashda xatolik. Qayta urinib ko'ring.");

    const token = process.env["TELEGRAM_BOT_TOKEN"];
    const chatId = process.env["TELEGRAM_CHAT_ID"];
    if (token && chatId) {
      try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text:
              `🩺 Doktor ko'rigiga yangi yozilish\n\n` +
              `👨‍⚕️ Doktor: ${data.doctor_name}\n` +
              `👤 Mijoz: ${data.customer_name}\n` +
              `📞 Telefon: ${phone}`,
          }),
        });
      } catch (e) {
        console.error("appointment telegram send failed", e);
      }
    }
    return { ok: true };
  });
