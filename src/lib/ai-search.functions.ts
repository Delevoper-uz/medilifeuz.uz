import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AiMedicine = {
  id: string;
  name: string;
  name_cyrl: string | null;
  price: number;
  image_url: string | null;
  language: string;
};

export type AiSearchResult = {
  ok: boolean;
  /** AI aniqlagan dori nomlari */
  names: string[];
  /** Bazadan topilgan dorilar */
  found: AiMedicine[];
  /** AI tushunmagan yoki bazada topilmagan nomlar */
  missing: string[];
  sentToTelegram: boolean;
  message: string;
};

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
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

/** Matndan dori nomlariga o'xshash so'zlarni ajratadi. */
export function extractCandidateNames(text: string): string[] {
  const out: string[] = [];
  for (const rawLine of text.split(/[\n,;•·]+/)) {
    const line = rawLine
      .replace(/\d+\s*(dona|donа|tab|таб|mg|мг|ml|мл|x|х)\b/gi, " ")
      .replace(/[^\p{L}\p{N}\s'-]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (line.length < 3) continue;
    out.push(line);
  }
  return Array.from(new Set(out)).slice(0, 40);
}

/** Nomlar ro'yxati bo'yicha bazadan dorilarni izlaydi. */
export async function lookupMedicines(names: string[]): Promise<{ found: AiMedicine[]; missing: string[] }> {
  const supabase = publicClient();
  const found: AiMedicine[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();

  for (const name of names) {
    const tokens = name.split(" ").filter((t) => t.length >= 3);
    const term = (tokens[0] ?? name).replace(/[%,()*"']/g, "");
    if (!term) continue;
    const { data } = await supabase
      .from("medicines")
      .select("id, name, name_cyrl, price, image_url, language")
      .or(`name.ilike.%${term}%,name_cyrl.ilike.%${term}%`)
      .limit(4);
    const rows = (data ?? []) as AiMedicine[];
    if (!rows.length) {
      missing.push(name);
      continue;
    }
    for (const r of rows) {
      const key = `${r.name.toLowerCase()}|${r.price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push(r);
    }
  }
  return { found, missing };
}

async function sendImageToTelegram(dataUrl: string, note: string): Promise<boolean> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  const chatId = process.env["TELEGRAM_CHAT_ID"];
  if (!token || !chatId) return false;
  try {
    const [meta, b64] = dataUrl.split(",");
    const mime = /data:(.*?);/.exec(meta ?? "")?.[1] ?? "image/jpeg";
    const bytes = Uint8Array.from(atob(b64 ?? ""), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("caption", note);
    form.append("photo", new Blob([bytes], { type: mime }), "royxat.jpg");
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: form });
    return res.ok;
  } catch (e) {
    console.error("telegram sendPhoto failed", e);
    return false;
  }
}

/** Rasmdagi dorilar ro'yxatini AI orqali tahlil qiladi. */
export const analyzeMedicineImage = createServerFn({ method: "POST" })
  .inputValidator((input: { imageDataUrl: string }) => {
    if (!input?.imageDataUrl?.startsWith("data:image/")) throw new Error("Rasm noto'g'ri");
    if (input.imageDataUrl.length > 8_000_000) throw new Error("Rasm juda katta (maks ~6MB)");
    return input;
  })
  .handler(async ({ data }): Promise<AiSearchResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    let names: string[] = [];

    if (apiKey) {
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content:
                  "Sen dorixona yordamchisisan. Rasmdagi dorilar ro'yxatini o'qib, faqat dori nomlarini qaytar. " +
                  'Javob faqat JSON: {"names":["nom1","nom2"]}. Dozalar, sonlar, izohlarni qo\'shma. Hech narsa topilmasa {"names":[]}.',
              },
              {
                role: "user",
                content: [
                  { type: "text", text: "Bu rasmdagi dorilar ro'yxatini o'qib ber." },
                  { type: "image_url", image_url: { url: data.imageDataUrl } },
                ],
              },
            ],
          }),
        });
        if (!res.ok) {
          console.error("ai gateway error", res.status, await res.text());
        } else {
          const json = await res.json();
          const content: string = json?.choices?.[0]?.message?.content ?? "";
          const match = /\{[\s\S]*\}/.exec(content);
          if (match) {
            const parsed = JSON.parse(match[0]) as { names?: unknown };
            if (Array.isArray(parsed.names)) {
              names = parsed.names
                .map((n) => String(n).trim())
                .filter((n) => n.length >= 3)
                .slice(0, 40);
            }
          }
        }
      } catch (e) {
        console.error("ai analyze failed", e);
      }
    }

    if (!names.length) {
      const sent = await sendImageToTelegram(
        data.imageDataUrl,
        "⚠️ AI bu ro'yxatni tushunmadi. Iltimos, dorilar nomlarini matn ko'rinishida guruhga yozib yuboring — bot topilgan dorilarni qaytaradi.",
      );
      return {
        ok: false,
        names: [],
        found: [],
        missing: [],
        sentToTelegram: sent,
        message: sent
          ? "AI ro'yxatni tushunmadi. Rasm operatorlarga (Telegram) yuborildi."
          : "AI ro'yxatni tushunmadi va rasmni yuborish imkoni bo'lmadi.",
      };
    }

    const { found, missing } = await lookupMedicines(names);
    return {
      ok: true,
      names,
      found,
      missing,
      sentToTelegram: false,
      message: found.length ? `${found.length} ta dori topildi.` : "Ro'yxatdagi dorilar bazada topilmadi.",
    };
  });

/** Telegram botdan "BO'LDI SHULAR" bilan yuborilgan oxirgi ro'yxatni qaytaradi. */
export const getBotSharedList = createServerFn({ method: "GET" }).handler(async (): Promise<AiSearchResult> => {
  const supabase = publicClient() as unknown as { from: (t: string) => any };
  const { data } = await supabase
    .from("bot_shared_lists")
    .select("names, created_at")
    .order("created_at", { ascending: false })
    .limit(1);
  const names: string[] = (data ?? [])[0]?.names ?? [];
  if (!names.length) {
    return { ok: false, names: [], found: [], missing: [], sentToTelegram: false, message: "Botdan ro'yxat kelmagan." };
  }
  const { found, missing } = await lookupMedicines(names);
  return {
    ok: true,
    names,
    found,
    missing,
    sentToTelegram: false,
    message: found.length ? `Botdan kelgan ro'yxat: ${found.length} ta dori topildi.` : "Ro'yxatdagi dorilar topilmadi.",
  };
});
