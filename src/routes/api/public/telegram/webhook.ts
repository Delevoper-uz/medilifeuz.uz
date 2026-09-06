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

        // 1) Filial tugmasi bosilganda buyurtmani qabul qilish
        const cb = update.callback_query;
        if (cb) {
          const dataStr: string = cb.data ?? "";
          const answer = (text: string) =>
            fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: cb.id, text }),
            }).catch(() => undefined);

          const m = /^take:(\d{1,2}):([0-9a-f-]{36})$/.exec(dataStr);
          if (m) {
            const branch = `${m[1]}-Filial`;
            const orderId = m[2] as string;
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data: existing } = await supabaseAdmin
              .from("orders")
              .select("id, branch, status")
              .eq("id", orderId)
              .maybeSingle();
            if (existing?.branch) {
              await answer(`Bu buyurtma allaqachon ${existing.branch} tomonidan qabul qilingan.`);
              return Response.json({ ok: true });
            }
            await supabaseAdmin
              .from("orders")
              .update({ status: "processing", branch })
              .eq("id", orderId);
            await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: cb.message?.chat?.id,
                message_id: cb.message?.message_id,
                text: `${cb.message?.text ?? ""}\n\n✅ Buyurtma [${branch}] tomonidan qabul qilindi. To'lov turi: Naqd`,
                reply_markup: { inline_keyboard: [] },
              }),
            }).catch(() => undefined);
            await answer(`✅ ${branch} qabul qildi`);
            return Response.json({ ok: true });
          }

          if (dataStr === "ai_share") {
            const src: string = cb.message?.text ?? "";
            const names = src
              .split("\n")
              .map((l) => /^\s*\d+\.\s*(.+?)\s*(?:—|\()/.exec(l)?.[1]?.trim())
              .filter((n): n is string => !!n && n.length >= 3);
            if (names.length) {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              await (supabaseAdmin as unknown as { from: (t: string) => any })
                .from("bot_shared_lists")
                .insert({ chat_id: cb.message?.chat?.id ?? null, names });
            }
            await answer("✅ Ro'yxat saytga yuborildi");
            await send(token, {
              chat_id: cb.message?.chat?.id,
              text: `✅ Bo'ldi shular (${names.length} ta). Saytdagi "Botdan kelgan ro'yxat" tugmasini bosib to'liq ko'rishingiz mumkin.`,
            });
            return Response.json({ ok: true });
          }

          if (dataStr === "ai_done" || dataStr === "ai_more") {
            await answer(dataStr === "ai_done" ? "✅ Buyurtma yakunlandi" : "➕ Keyingi dorini yuboring");
            if (cb.message?.chat?.id) {
              await send(token, {
                chat_id: cb.message.chat.id,
                text:
                  dataStr === "ai_done"
                    ? "✅ Bo'ldi. Buyurtmangiz qabul qilindi, operator siz bilan bog'lanadi."
                    : "➕ Yana dori nomini yoki rasmini yuboring.",
              });
            }
            return Response.json({ ok: true });
          }
          await answer("");
          return Response.json({ ok: true });
        }

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
          const first = found[0];
          const reply = found.length
            ? `🔎 Topilgan dorilar (${found.length}):\n${lines.join("\n")}${
                missing.length ? `\n\n❌ Topilmadi: ${missing.slice(0, 20).join(", ")}` : ""
              }\n\n🛒 Savatga qo'shildi: ${first?.name ?? ""}`
            : `🛒 Savatga qo'shildi: ${names[0]}\n(AI aniq tushunmadi, 1-dori qo'shildi)`;
          await send(token, {
            chat_id: chatId,
            text: reply,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "➕ Yana qo'shamiz", callback_data: "ai_more" },
                  { text: "✅ Bo'ldi shu xolos", callback_data: "ai_done" },
                ],
                [{ text: "✅ BO'LDI SHULAR", callback_data: "ai_share" }],
              ],
            },
          });
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
