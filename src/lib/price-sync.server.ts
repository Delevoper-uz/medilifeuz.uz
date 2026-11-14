import * as XLSX from "xlsx";
import { normalizeSearch } from "./search";

export type SyncKey = { location: "header" | "query"; name: string; value: string };
export type SyncSettings = {
  source_url: string | null; http_method: string; keys: SyncKey[];
  name_column: string | null; name_col_index: number | null;
  stock_column: string | null; stock_col_index: number | null;
  price_column: string | null; price_col_index: number | null;
  header_row: number; interval_minutes: number; enabled: boolean;
  last_run_at: string | null; last_status: string | null;
};

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export async function loadSettings(): Promise<SyncSettings | null> {
  const db = await admin();
  const { data, error } = await db.from("price_sync_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as any) ?? null;
}

function findArray(v: any, depth = 0): any[] | null {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object" && depth < 4) for (const k of Object.keys(v)) { const a = findArray(v[k], depth + 1); if (a) return a; }
  return null;
}

/** Manbadan jadval: birinchi qator sarlavha, qolganlari ma'lumot. */
async function fetchTable(s: SyncSettings): Promise<{ headers: string[]; rows: any[][] }> {
  if (!s.source_url) throw new Error("Manba URL kiritilmagan");
  const url = new URL(s.source_url);
  const headers = new Headers();
  for (const k of s.keys ?? []) {
    if (!k.name) continue;
    if (k.location === "query") url.searchParams.set(k.name, k.value); else headers.set(k.name, k.value);
  }
  const res = await fetch(url, { method: s.http_method === "POST" ? "POST" : "GET", headers });
  if (!res.ok) throw new Error(`Manba javobi ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const text = new TextDecoder().decode(buf).trim();
  const hr = Math.max(1, s.header_row || 1);
  if (text.startsWith("{") || text.startsWith("[")) {
    const arr = findArray(JSON.parse(text)) ?? [];
    if (arr.length && Array.isArray(arr[0])) return { headers: (arr[hr - 1] ?? []).map(String), rows: arr.slice(hr) };
    const keys = Object.keys(arr[0] ?? {});
    return { headers: keys, rows: arr.map((o: any) => keys.map((k) => o?.[k])) };
  }
  const wb = buf[0] === 0x50 && buf[1] === 0x4b ? XLSX.read(buf, { type: "array" }) : XLSX.read(text, { type: "string" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const all = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null, raw: true });
  return { headers: (all[hr - 1] ?? []).map((v) => String(v ?? "")), rows: all.slice(hr) };
}

function colIndex(headers: string[], name: string | null, idx: number | null, label: string) {
  if (idx && idx > 0) return idx - 1;
  const n = normalizeSearch(name);
  if (!n) throw new Error(`${label} ustuni ko'rsatilmagan`);
  let i = headers.findIndex((h) => normalizeSearch(h) === n);
  if (i < 0) i = headers.findIndex((h) => normalizeSearch(h).includes(n));
  if (i < 0) throw new Error(`"${name}" ustuni topilmadi`);
  return i;
}

export function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v ?? "").replace(/\s|\u00a0/g, "").replace(",", ".").replace(/[^0-9.\-]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function runPriceSync(): Promise<string> {
  const db = await admin();
  const s = await loadSettings();
  if (!s) throw new Error("Sozlamalar saqlanmagan");
  let status: string;
  try {
    const { headers, rows } = await fetchTable(s);
    const ni = colIndex(headers, s.name_column, s.name_col_index, "Dori nomi");
    const si = colIndex(headers, s.stock_column, s.stock_col_index, "Qoldiq");
    const pi = colIndex(headers, s.price_column, s.price_col_index, "Narx");
    const src = new Map<string, { price: number | null; stock: number | null }>();
    for (const r of rows) {
      const key = normalizeSearch(r?.[ni] == null ? "" : String(r[ni]));
      if (!key) continue;
      const stock = toNumber(r[si]);
      src.set(key, { price: toNumber(r[pi]), stock: stock == null ? null : Math.max(0, Math.round(stock)) });
    }
    // Barcha dorilar (lotin va kirill) — nom yoki kirill nomi bo'yicha moslanadi
    const groups = new Map<string, string[]>();
    let matched = 0;
    let last: string | null = null;
    for (;;) {
      let q = db.from("medicines").select("id, name, name_cyrl, price, stock").order("id").limit(1000);
      if (last) q = q.gt("id", last);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      if (!data?.length) break;
      for (const m of data) {
        const v = src.get(normalizeSearch(m.name)) ?? (m.name_cyrl ? src.get(normalizeSearch(m.name_cyrl)) : undefined);
        if (!v) continue;
        matched++;
        const price = v.price ?? Number(m.price);
        const stock = v.stock ?? m.stock;
        if (price === Number(m.price) && stock === m.stock) continue;
        const g = `${price}|${stock}`;
        groups.set(g, [...(groups.get(g) ?? []), m.id]);
      }
      last = data[data.length - 1].id;
      if (data.length < 1000) break;
    }
    let updated = 0;
    for (const [g, ids] of groups) {
      const [price, stock] = g.split("|").map(Number);
      for (let i = 0; i < ids.length; i += 200) {
        const { error } = await db.from("medicines").update({ price, stock }).in("id", ids.slice(i, i + 200));
        if (error) throw new Error(error.message);
      }
      updated += ids.length;
    }
    status = `OK: manbada ${src.size} ta, mos kelgan ${matched} ta, yangilangan ${updated} ta`;
  } catch (e: any) {
    status = `Xato: ${e?.message ?? e}`;
  }
  await db.from("price_sync_settings").update({ last_run_at: new Date().toISOString(), last_status: status }).eq("id", 1);
  return status;
}

export async function runIfDue(): Promise<string> {
  const s = await loadSettings();
  if (!s?.enabled) return "o'chirilgan";
  const due = !s.last_run_at || Date.now() - new Date(s.last_run_at).getTime() >= (s.interval_minutes - 1) * 60_000;
  return due ? runPriceSync() : "vaqti kelmagan";
}
