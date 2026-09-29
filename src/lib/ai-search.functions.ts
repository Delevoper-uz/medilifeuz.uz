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

export type AiGroup = {
  /** Retseptdagi nom */
  query: string;
  /** Aniq mos kelganmi yoki o'xshash */
  exact: boolean;
  /** Bazadagi mos yoki o'xshash dorilar (raqamlangan ro'yxat) */
  candidates: AiMedicine[];
};

export type AiSearchResult = {
  ok: boolean;
  /** AI aniqlagan dori nomlari */
  names: string[];
  /** Har bir nom bo'yicha topilgan variantlar */
  groups: AiGroup[];
  /** Bazadan topilgan dorilar (eski moslik uchun) */
  found: AiMedicine[];
  /** Hech narsa topilmagan nomlar */
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

const SELECT = "id, name, name_cyrl, price, image_url, language";

function clean(s: string) {
  return s.replace(/[%,()*"'.:]/g, "").trim();
}

/** Bitta nom bo'yicha aniq, bo'lmasa o'xshash dorilarni topadi. */
async function lookupOne(
  supabase: ReturnType<typeof publicClient>,
  name: string,
): Promise<AiGroup> {
  const tokens = name
    .split(/\s+/)
    .map(clean)
    .filter((t) => t.length >= 3);
  const first = tokens[0] ?? clean(name);
  const q = (term: string, limit: number) =>
    supabase.from("medicines").select(SELECT).or(`name.ilike.%${term}%,name_cyrl.ilike.%${term}%`).limit(limit);

  if (first) {
    const { data } = await q(first, 8);
    const rows = (data ?? []) as AiMedicine[];
    if (rows.length) {
      // Ikkinchi so'z ham mos kelganlarni oldinga chiqaramiz
      const second = tokens[1]?.toLowerCase();
      if (second) {
        rows.sort((a, b) => {
          const sa = `${a.name} ${a.name_cyrl ?? ""}`.toLowerCase().includes(second) ? 0 : 1;
          const sb = `${b.name} ${b.name_cyrl ?? ""}`.toLowerCase().includes(second) ? 0 : 1;
          return sa - sb;
        });
      }
      return { query: name, exact: true, candidates: rows.slice(0, 6) };
    }
  }

  // O'xshash: so'z boshidagi 5, keyin 4 harf bo'yicha
  for (const len of [5, 4]) {
    const stem = first.slice(0, len);
    if (stem.length < 4) continue;
    const { data } = await q(stem, 6);
    const rows = (data ?? []) as AiMedicine[];
    if (rows.length) return { query: name, exact: false, candidates: rows };
  }
  return { query: name, exact: false, candidates: [] };
}

/** Nomlar bo'yicha barcha qidiruvlarni parallel bajaradi. */
export async function lookupGroups(names: string[]): Promise<AiGroup[]> {
  const supabase = publicClient();
  return Promise.all(names.map((n) => lookupOne(supabase, n).catch(() => ({ query: n, exact: false, candidates: [] }))));
}

/** Eski moslik: tekis ro'yxat. */
export async function lookupMedicines(names: string[]): Promise<{ found: AiMedicine[]; missing: string[] }> {
  const groups = await lookupGroups(names);
  const found: AiMedicine[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const g of groups) {
    if (!g.candidates.length) {
      missing.push(g.query);
      continue;
    }
    for (const r of g.candidates.slice(0, 4)) {
      const key = `${r.name.toLowerCase()}|${r.price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push(r);
    }
  }
  return { found, missing };
}

function buildResult(names: string[], groups: AiGroup[], prefix = ""): AiSearchResult {
  const found = groups.filter((g) => g.exact).flatMap((g) => g.candidates.slice(0, 1));
  const missing = groups.filter((g) => !g.candidates.length).map((g) => g.query);
  const withAny = groups.filter((g) => g.candidates.length).length;
  return {
    ok: true,
    names,
    groups,
    found,
    missing,
    sentToTelegram: false,
    message: withAny
      ? `${prefix}${withAny} ta dori bo'yicha variantlar topildi.`
      : `${prefix}Ro'yxatdagi dorilar bazada topilmadi.`,
  };
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

const SYSTEM_PROMPT =
  "Sen tajribali farmatsevtsan. Rasmdagi retsept yoki dorilar ro'yxatini (qo'lyozma bo'lsa ham) o'qi. " +
  "Har bir dori uchun eng ehtimoliy savdo nomini yoz (lotin yoki kirillda, rasmda qanday bo'lsa). " +
  "Qo'lyozma noaniq bo'lsa ham eng yaqin haqiqiy dori nomini taxmin qil. Dozalar, sonlar, 'Rp', 'D.S.' kabi izohlarni yozma. " +
  'Javob faqat JSON: {"names":["nom1","nom2"]}. Hech narsa bo\'lmasa {"names":[]}.';

/** AI gateway'ga tez (streaming, past reasoning) so'rov yuborib nomlarni oladi. */
async function readNamesWithAi(imageDataUrl: string, apiKey: string): Promise<string[]> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT }] },
        {
          role: "user",
          content: [
            { type: "input_text", text: "Rasmdagi dorilar nomlarini JSON qilib ber." },
            { type: "input_image", image_url: imageDataUrl },
          ],
        },
      ],
    }),
  });
  if (!res.ok || !res.body) {
    console.error("ai gateway error", res.status, await res.text().catch(() => ""));
    return [];
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const ev = JSON.parse(payload) as { type?: string; delta?: string };
          if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
        } catch {
          /* qisman kadr */
        }
      }
    }
  }
  const match = /\{[\s\S]*\}/.exec(text);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as { names?: unknown };
    if (!Array.isArray(parsed.names)) return [];
    return Array.from(
      new Set(parsed.names.map((n) => String(n).trim()).filter((n) => n.length >= 3)),
    ).slice(0, 30);
  } catch {
    return [];
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
        names = await readNamesWithAi(data.imageDataUrl, apiKey);
      } catch (e) {
        console.error("ai analyze failed", e);
      }
    }
    if (!names.length) {
      return {
        ok: false,
        names: [],
        groups: [],
        found: [],
        missing: [],
        sentToTelegram: false,
        message: "AI rasmni o'qiy olmadi. Aniqroq rasm yuklang yoki operatorga yuboring.",
      };
    }
    return buildResult(names, await lookupGroups(names));
  });

/** Foydalanuvchi o'zi so'ragandagina rasmni operatorlar guruhiga yuboradi. */
export const sendPrescriptionToOperators = createServerFn({ method: "POST" })
  .inputValidator((input: { imageDataUrl: string; note?: string }) => {
    if (!input?.imageDataUrl?.startsWith("data:image/")) throw new Error("Rasm noto'g'ri");
    if (input.imageDataUrl.length > 8_000_000) throw new Error("Rasm juda katta");
    return { imageDataUrl: input.imageDataUrl, note: String(input.note ?? "").slice(0, 500) };
  })
  .handler(async ({ data }) => {
    const sent = await sendImageToTelegram(
      data.imageDataUrl,
      `📋 Mijoz retseptdagi dorilarni topa olmadi.${data.note ? `\nTopilmaganlar: ${data.note}` : ""}\nIltimos, dorilar nomini matn ko'rinishida yozib yuboring.`,
    );
    return { ok: sent };
  });

/** Telegram botdan "BO'LDI SHULAR" bilan yuborilgan oxirgi ro'yxatni qaytaradi. */
export const getBotSharedList = createServerFn({ method: "GET" }).handler(async (): Promise<AiSearchResult> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const supabase = supabaseAdmin as unknown as { from: (t: string) => any };
  const { data } = await supabase
    .from("bot_shared_lists")
    .select("names, created_at")
    .order("created_at", { ascending: false })
    .limit(1);
  const names: string[] = (data ?? [])[0]?.names ?? [];
  if (!names.length) {
    return {
      ok: false,
      names: [],
      groups: [],
      found: [],
      missing: [],
      sentToTelegram: false,
      message: "Botdan ro'yxat kelmagan.",
    };
  }
  return buildResult(names, await lookupGroups(names), "Botdan kelgan ro'yxat: ");
});
