import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

/** Narx boti: dorilarni tekshiradi va narxlarini bazada yangilaydi. */

type Item = {
  query: string;
  id: string | null;
  name: string;
  found: boolean;
  price: number | null;
  newPrice: number | null;
};

type Session = {
  chat_id: number;
  lang: "latin" | "cyrillic";
  step: string;
  items: Item[];
};

function deriveSecret(botToken: string): string {
  return createHash("sha256").update(`telegram-webhook:${botToken}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const l = Buffer.from(a);
  const r = Buffer.from(b);
  return l.length === r.length && timingSafeEqual(l, r);
}

async function tg(token: string, method: string, body: Record<string, unknown>) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error("price-bot telegram error", method, res.status, await res.text());
  } catch (e) {
    console.error("price-bot telegram failed", method, e);
  }
}

const LANG_KB = {
  inline_keyboard: [
    [
      { text: "🇺🇿 Uz (lotin)", callback_data: "lang:latin" },
      { text: "🇺🇿 Кирилл", callback_data: "lang:cyrillic" },
    ],
  ],
};

function money(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n);
}

function parseNumbers(text: string): number[] {
  const out: number[] = [];
  for (const raw of text.split(/\n+/)) {
    const cleaned = raw.replace(/^\s*\d+\s*[.)-]\s*/, "");
    const m = /(\d[\d\s.,]*)/.exec(cleaned);
    if (!m) continue;
    const n = Number(String(m[1]).replace(/[\s.,]/g, ""));
    if (Number.isFinite(n) && n > 0) out.push(n);
  }
  return out;
}

function listText(items: Item[]): string {
  return items
    .map((it, i) => `${i + 1}. ${it.found ? it.name : it.query} : ${it.found ? "BOR" : "YOQ"}`)
    .join("\n");
}

function pricesText(items: Item[]): string {
  return items
    .map(
      (it, i) =>
        `${i + 1}. ${it.found ? it.name : it.query} — ${
          it.newPrice != null ? `${money(it.newPrice)} so'm` : it.price != null ? `${money(it.price)} so'm (o'zgarmaydi)` : "—"
        }`,
    )
    .join("\n");
}

export const Route = createFileRoute("/api/public/telegram/price-bot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["PRICE_BOT_TOKEN"];
        if (!token) return new Response("not configured", { status: 500 });

        const expected = deriveSecret(token);
        const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(got, expected)) return new Response("Unauthorized", { status: 401 });

        const update = await request.json();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as unknown as {
          from: (t: string) => any;
        };

        const loadSession = async (chatId: number): Promise<Session> => {
          const { data } = await db.from("price_bot_sessions").select("*").eq("chat_id", chatId).maybeSingle();
          if (data) {
            return {
              chat_id: chatId,
              lang: data.lang === "cyrillic" ? "cyrillic" : "latin",
              step: String(data.step ?? "lang"),
              items: Array.isArray(data.items) ? (data.items as Item[]) : [],
            };
          }
          return { chat_id: chatId, lang: "latin", step: "lang", items: [] };
        };

        const saveSession = async (s: Session) => {
          await db
            .from("price_bot_sessions")
            .upsert({ chat_id: s.chat_id, lang: s.lang, step: s.step, items: s.items }, { onConflict: "chat_id" });
        };

        const lookup = async (name: string, lang: "latin" | "cyrillic"): Promise<Item> => {
          const term = name.replace(/[%,()*"']/g, "").trim();
          const tokens = term.split(/\s+/).filter((t) => t.length >= 3);
          const q = tokens[0] ?? term;
          const { data } = await db
            .from("medicines")
            .select("id, name, name_cyrl, price, language")
            .eq("language", lang)
            .or(`name.ilike.%${q}%,name_cyrl.ilike.%${q}%`)
            .limit(1);
          const row = (data ?? [])[0];
          if (!row) return { query: name, id: null, name, found: false, price: null, newPrice: null };
          const display = lang === "cyrillic" ? row.name_cyrl || row.name : row.name;
          return { query: name, id: row.id, name: display, found: true, price: Number(row.price), newPrice: null };
        };

        const askNames = async (chatId: number) =>
          tg(token, "sendMessage", {
            chat_id: chatId,
            text: "📝 Dorilar ro'yxatini yuboring (har bir dori yangi qatordan).",
          });

        const showList = async (chatId: number, s: Session) =>
          tg(token, "sendMessage", {
            chat_id: chatId,
            text: `${listText(s.items)}\n\nℹ️ Biror dorini almashtirish uchun uning raqamini yuboring (masalan: 2).`,
            reply_markup: {
              inline_keyboard: [
                [{ text: "💰 Narxlarni yuborish", callback_data: "prices" }],
                [{ text: "♻️ Boshqa ro'yxat", callback_data: "restart" }],
              ],
            },
          });

        // --- Inline tugmalar ---
        const cb = update.callback_query;
        if (cb) {
          const chatId: number | undefined = cb.message?.chat?.id;
          const data: string = cb.data ?? "";
          await tg(token, "answerCallbackQuery", { callback_query_id: cb.id });
          if (!chatId) return Response.json({ ok: true });
          const s = await loadSession(chatId);

          if (data.startsWith("lang:")) {
            s.lang = data.endsWith("cyrillic") ? "cyrillic" : "latin";
            s.step = "names";
            s.items = [];
            await saveSession(s);
            await tg(token, "sendMessage", {
              chat_id: chatId,
              text: s.lang === "cyrillic" ? "✅ Til: Кирилл" : "✅ Til: Uz (lotin)",
            });
            await askNames(chatId);
            return Response.json({ ok: true });
          }

          if (data === "restart") {
            s.step = "lang";
            s.items = [];
            await saveSession(s);
            await tg(token, "sendMessage", { chat_id: chatId, text: "Tilni tanlang:", reply_markup: LANG_KB });
            return Response.json({ ok: true });
          }

          if (data === "prices") {
            if (!s.items.length) {
              await askNames(chatId);
              return Response.json({ ok: true });
            }
            s.step = "prices";
            await saveSession(s);
            await tg(token, "sendMessage", {
              chat_id: chatId,
              text: `💰 Narxlarni shu tartibda yuboring:\n${s.items
                .map((it, i) => `${i + 1}. ${it.found ? it.name : it.query}`)
                .join("\n")}\n\nMisol:\n1. 12000\n2. 20000\n3. 3000`,
            });
            return Response.json({ ok: true });
          }

          if (data === "apply") {
            const targets = s.items.filter((it) => it.found && it.id && it.newPrice != null);
            let done = 0;
            for (const it of targets) {
              const { error } = await db.from("medicines").update({ price: it.newPrice }).eq("id", it.id as string);
              if (!error) done += 1;
            }
            s.step = "lang";
            s.items = [];
            await saveSession(s);
            await tg(token, "sendMessage", {
              chat_id: chatId,
              text: `✅ ${done} ta dori narxi bazada o'zgartirildi.`,
              reply_markup: LANG_KB,
            });
            return Response.json({ ok: true });
          }

          return Response.json({ ok: true });
        }

        // --- Matnli xabarlar ---
        const message = update.message ?? update.edited_message;
        const chatId: number | undefined = message?.chat?.id;
        const text: string = (message?.text ?? message?.caption ?? "").trim();
        if (!chatId) return Response.json({ ok: true });

        if (!text || text.startsWith("/start") || text.startsWith("/til")) {
          const s = await loadSession(chatId);
          s.step = "lang";
          s.items = [];
          await saveSession(s);
          await tg(token, "sendMessage", {
            chat_id: chatId,
            text: "Assalomu alaykum! Bu — MediLife narx boti.\nAvval tilni tanlang:",
            reply_markup: LANG_KB,
          });
          return Response.json({ ok: true });
        }

        const s = await loadSession(chatId);

        if (s.step === "lang") {
          await tg(token, "sendMessage", { chat_id: chatId, text: "Avval tilni tanlang:", reply_markup: LANG_KB });
          return Response.json({ ok: true });
        }

        if (s.step.startsWith("rename:")) {
          const idx = Number(s.step.split(":")[1]);
          const item = await lookup(text, s.lang);
          if (Number.isFinite(idx) && s.items[idx]) s.items[idx] = item;
          s.step = "review";
          await saveSession(s);
          await showList(chatId, s);
          return Response.json({ ok: true });
        }

        if (s.step === "review" && /^\d{1,3}$/.test(text)) {
          const idx = Number(text) - 1;
          if (idx < 0 || idx >= s.items.length) {
            await tg(token, "sendMessage", { chat_id: chatId, text: "Bunday raqam ro'yxatda yo'q." });
            return Response.json({ ok: true });
          }
          s.step = `rename:${idx}`;
          await saveSession(s);
          await tg(token, "sendMessage", { chat_id: chatId, text: `✏️ ${idx + 1}-dori nomini yuboring.` });
          return Response.json({ ok: true });
        }

        if (s.step === "prices") {
          const nums = parseNumbers(text);
          if (!nums.length) {
            await tg(token, "sendMessage", { chat_id: chatId, text: "Narxlar topilmadi. Masalan: 1. 12000" });
            return Response.json({ ok: true });
          }
          s.items = s.items.map((it, i) => ({ ...it, newPrice: nums[i] != null ? (nums[i] as number) : it.newPrice }));
          await saveSession(s);
          await tg(token, "sendMessage", {
            chat_id: chatId,
            text: `${pricesText(s.items)}\n\nTasdiqlaysizmi?`,
            reply_markup: {
              inline_keyboard: [
                [{ text: "✅ BO'LDI O'ZGARTIRISH", callback_data: "apply" }],
                [{ text: "♻️ Boshqa ro'yxat", callback_data: "restart" }],
              ],
            },
          });
          return Response.json({ ok: true });
        }

        // step === "names" yoki "review" (yangi ro'yxat)
        const { extractCandidateNames } = await import("@/lib/ai-search.functions");
        const names = extractCandidateNames(text);
        if (!names.length) {
          await askNames(chatId);
          return Response.json({ ok: true });
        }
        const items: Item[] = [];
        for (const n of names.slice(0, 30)) items.push(await lookup(n, s.lang));
        s.items = items;
        s.step = "review";
        await saveSession(s);
        await showList(chatId, s);
        return Response.json({ ok: true });
      },
    },
  },
});
