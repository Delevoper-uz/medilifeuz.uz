import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

function deriveSecret(botToken: string): string {
  return createHash("sha256").update(`telegram-webhook:${botToken}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function send(token: string, body: Record<string, unknown>) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error("telegram send failed", e);
  }
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["TELEGRAM_BOT_TOKEN"];
        if (!token) return new Response("not configured", { status: 500 });

        const expected = deriveSecret(token);
        const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(got, expected)) return new Response("Unauthorized", { status: 401 });

        const update = await request.json();
        const message = update.message ?? update.edited_message;
        const chatId = message?.chat?.id;
        if (!chatId) return Response.json({ ok: true });

        // Guruhga matn yozilsa — matndagi dorilarni bazadan izlab javob qaytaramiz.
        const chatType: string = message?.chat?.type ?? "private";
        const text: string = message?.text ?? message?.caption ?? "";
        if (chatType.includes("group") && text && !text.startsWith("/")) {
          const { extractCandidateNames, lookupMedicines } = await import("@/lib/ai-search.functions");
          const names = extractCandidateNames(text);
          if (!names.length) return Response.json({ ok: true });
          const { found, missing } = await lookupMedicines(names);
          const lines = found
            .slice(0, 40)
            .map((m, i) => `${i + 1}. ${m.name}${m.name_cyrl ? ` (${m.name_cyrl})` : ""} — ${m.price} so'm`);
          const reply = found.length
            ? `🔎 Topilgan dorilar (${found.length}):\n${lines.join("\n")}${
                missing.length ? `\n\n❌ Topilmadi: ${missing.slice(0, 20).join(", ")}` : ""
              }`
            : `❌ Bu matndagi dorilar bazada topilmadi: ${names.slice(0, 20).join(", ")}`;
          await send(token, { chat_id: chatId, text: reply });
          return Response.json({ ok: true });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");


        if (message.contact?.phone_number) {
          const phoneDigits = String(message.contact.phone_number).replace(/[^\d]/g, "");
          if (phoneDigits.length !== 12 || !phoneDigits.startsWith("998")) {
            await send(token, { chat_id: chatId, text: "Faqat +998 bilan boshlanadigan raqam qabul qilinadi." });
            return Response.json({ ok: true });
          }
          const { error } = await supabaseAdmin.from("telegram_users").upsert(
            {
              phone_number: `+${phoneDigits}`,
              chat_id: chatId,
              first_name: message.contact.first_name ?? message.from?.first_name ?? null,
              last_name: message.contact.last_name ?? message.from?.last_name ?? null,
              username: message.from?.username ?? null,
            },
            { onConflict: "phone_number" },
          );
          if (error) {
            console.error("telegram_users upsert failed", error.message);
            await send(token, { chat_id: chatId, text: "Xatolik yuz berdi. Keyinroq urinib ko'ring." });
            return Response.json({ ok: true });
          }
          await send(token, {
            chat_id: chatId,
            text: "✅ Raqamingiz saqlandi! Endi MediLife saytida shu raqam bilan kirishingiz mumkin.",
            reply_markup: { remove_keyboard: true },
          });
          return Response.json({ ok: true });
        }

        await send(token, {
          chat_id: chatId,
          text: "Assalomu alaykum! MediLife saytiga kirish uchun quyidagi tugma orqali telefon raqamingizni yuboring.",
          reply_markup: {
            keyboard: [[{ text: "📞 Raqamimni yuborish", request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        });
        return Response.json({ ok: true });
      },
    },
  },
});
