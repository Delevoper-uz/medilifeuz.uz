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

          if (dataStr === "ai_share" || dataStr === "ai_done" || dataStr === "ai_more") {
            const gChat = cb.message?.chat?.id;
            await answer(
              dataStr === "ai_share" ? "✅ Ro'yxat saytga yuborildi" : dataStr === "ai_done" ? "✅ Yakunlandi" : "➕ Keyingi dori",
            );
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const gdb = supabaseAdmin as unknown as { from: (t: string) => any };
            const { data: sess } = gChat
              ? await gdb.from("bot_group_sessions").select("*").eq("chat_id", gChat).maybeSingle()
              : { data: null };
            const names: string[] = sess?.chosen ?? [];
            if (dataStr === "ai_more") {
              if (gChat) await gdb.from("bot_group_sessions").upsert({ chat_id: gChat, items: [], chosen: names, step: "more" }, { onConflict: "chat_id" });
              if (gChat) await send(token, { chat_id: gChat, text: "➕ Yana dori nomini yuboring." });
              return Response.json({ ok: true });
            }
            if (dataStr === "ai_share" && names.length) {
              await gdb.from("bot_shared_lists").insert({ chat_id: gChat ?? null, names });
            }
            if (gChat) {
              await gdb.from("bot_group_sessions").upsert({ chat_id: gChat, items: [], chosen: [], step: "idle" }, { onConflict: "chat_id" });
              await send(token, {
                chat_id: gChat,
                text:
                  dataStr === "ai_share"
                    ? `✅ Bo'ldi shular (${names.length} ta):\n${names.map((n, i) => `${i + 1}. ${n}`).join("\n")}\n\nSaytdagi "Botdan kelgan ro'yxat" tugmasi orqali ko'rish mumkin.`
                    : "✅ Bo'ldi. Buyurtmangiz qabul qilindi, operator siz bilan bog'lanadi.",
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


        // Guruh: 1) dorilarni topadi 2) raqam so'raydi 3) tanlangandan keyin tugmalar.
        const chatType: string = message?.chat?.type ?? "private";
        const text: string = message?.text ?? message?.caption ?? "";
        if (chatType.includes("group") && text && !text.startsWith("/")) {
          const { supabaseAdmin: sa } = await import("@/integrations/supabase/client.server");
          const gdb = sa as unknown as { from: (t: string) => any };
          const { data: sess } = await gdb.from("bot_group_sessions").select("*").eq("chat_id", chatId).maybeSingle();
          const items: { name: string; name_cyrl?: string | null; price: number }[] = sess?.items ?? [];
          const chosen: string[] = sess?.chosen ?? [];

          const num = /^\s*(\d{1,3})\s*$/.exec(text);
          if (num && sess?.step === "choose" && items.length) {
            const idx = Number(num[1]) - 1;
            const pick = items[idx];
            if (!pick) {
              await send(token, { chat_id: chatId, text: `❗ 1 dan ${items.length} gacha raqam yuboring.` });
              return Response.json({ ok: true });
            }
            const nextChosen = [...chosen, pick.name];
            await gdb.from("bot_group_sessions").upsert(
              { chat_id: chatId, items, chosen: nextChosen, step: "chosen" },
              { onConflict: "chat_id" },
            );
            await send(token, {
              chat_id: chatId,
              text: `🛒 Savatga qo'shildi: ${pick.name}${pick.name_cyrl ? ` (${pick.name_cyrl})` : ""} — ${pick.price} so'm\n\nTanlanganlar: ${nextChosen.length} ta`,
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
          if (num) return Response.json({ ok: true });

          const { extractCandidateNames, lookupMedicines } = await import("@/lib/ai-search.functions");
          const names = extractCandidateNames(text);
          if (!names.length) return Response.json({ ok: true });
          const { found, missing } = await lookupMedicines(names);
          const list = found.slice(0, 30).map((m) => ({ name: m.name, name_cyrl: m.name_cyrl ?? null, price: m.price }));
          if (!list.length) {
            await send(token, { chat_id: chatId, text: `❌ Bazadan topilmadi: ${names.slice(0, 20).join(", ")}` });
            return Response.json({ ok: true });
          }
          await gdb.from("bot_group_sessions").upsert(
            { chat_id: chatId, items: list, chosen: sess?.step === "more" ? chosen : [], step: "choose" },
            { onConflict: "chat_id" },
          );
          const lines = list.map((m, i) => `${i + 1}. ${m.name}${m.name_cyrl ? ` (${m.name_cyrl})` : ""} — ${m.price} so'm`);
          await send(token, {
            chat_id: chatId,
            text:
              `🔎 Topilgan dorilar (${list.length}):\n${lines.join("\n")}` +
              (missing.length ? `\n\n❌ Topilmadi: ${missing.slice(0, 20).join(", ")}` : "") +
              `\n\n❓ Qaysi biri kerak? Raqamini yuboring (masalan: 1).`,
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
