import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getPriceSync, runPriceSyncNow, savePriceSync } from "@/lib/price-sync.functions";

type Key = { location: "header" | "query"; name: string; value: string; saved?: boolean };
const num = (v: string) => (v.trim() ? Math.max(0, parseInt(v, 10) || 0) : null);

export function PriceSyncAdmin() {
  const getFn = useServerFn(getPriceSync);
  const saveFn = useServerFn(savePriceSync);
  const runFn = useServerFn(runPriceSyncNow);
  const [s, setS] = useState<any>({ source_url: "", http_method: "GET", keys: [] as Key[], name_column: "", name_col_index: "", stock_column: "", stock_col_index: "", price_column: "", price_col_index: "", header_row: "1", enabled: false, last_run_at: null, last_status: null });
  const [days, setDays] = useState("0"); const [hours, setHours] = useState("24"); const [mins, setMins] = useState("0");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const d: any = await getFn();
    if (!d) return;
    const str = (v: any) => (v == null ? "" : String(v));
    setS({ ...d, source_url: str(d.source_url), name_column: str(d.name_column), name_col_index: str(d.name_col_index), stock_column: str(d.stock_column), stock_col_index: str(d.stock_col_index), price_column: str(d.price_column), price_col_index: str(d.price_col_index), header_row: str(d.header_row) });
    const m = d.interval_minutes as number;
    setDays(String(Math.floor(m / 1440))); setHours(String(Math.floor((m % 1440) / 60))); setMins(String(m % 60));
  };
  useEffect(() => { load().catch(() => toast.error("Sozlamalarni yuklab bo'lmadi")); }, []);

  const setKey = (i: number, p: Partial<Key>) => setS({ ...s, keys: s.keys.map((k: Key, j: number) => (j === i ? { ...k, ...p } : k)) });

  const save = async () => {
    const interval = (num(days) ?? 0) * 1440 + (num(hours) ?? 0) * 60 + (num(mins) ?? 0);
    if (interval < 15) return toast.error("Eng kami 15 daqiqa bo'lishi kerak");
    setBusy(true);
    try {
      await saveFn({ data: {
        source_url: s.source_url.trim() || null, http_method: s.http_method,
        keys: s.keys.map((k: Key) => ({ location: k.location, name: k.name, value: k.value })),
        name_column: s.name_column.trim() || null, name_col_index: num(s.name_col_index) || null,
        stock_column: s.stock_column.trim() || null, stock_col_index: num(s.stock_col_index) || null,
        price_column: s.price_column.trim() || null, price_col_index: num(s.price_col_index) || null,
        header_row: num(s.header_row) || 1, interval_minutes: interval, enabled: s.enabled,
      } });
      toast.success("Saqlandi"); await load();
    } catch (e: any) { toast.error(e?.message ?? "Saqlashda xatolik"); } finally { setBusy(false); }
  };

  const run = async () => {
    setBusy(true);
    try { const r = await runFn(); toast(r.status); await load(); } catch (e: any) { toast.error(e?.message ?? "Xatolik"); } finally { setBusy(false); }
  };

  const col = (label: string, nk: string, ik: string, ph: string) => (
    <div className="grid grid-cols-[1fr_110px] gap-2">
      <div><Label>{label} ustun nomi</Label><Input placeholder={ph} value={s[nk]} onChange={(e) => setS({ ...s, [nk]: e.target.value })} /></div>
      <div><Label>Ustun raqami</Label><Input type="number" min={1} placeholder="masalan 2" value={s[ik]} onChange={(e) => setS({ ...s, [ik]: e.target.value })} /></div>
    </div>
  );

  return (
    <div className="space-y-4 max-w-3xl">
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">1. Ulanish kalitlari (Datfo yoki boshqa dastur)</h3>
        <div className="grid grid-cols-[1fr_100px] gap-2">
          <div><Label>Manba manzili (API yoki Excel/CSV havola)</Label><Input placeholder="https://..." value={s.source_url} onChange={(e) => setS({ ...s, source_url: e.target.value })} /></div>
          <div><Label>Usul</Label>
            <select className="h-10 w-full rounded-md border bg-background px-2" value={s.http_method} onChange={(e) => setS({ ...s, http_method: e.target.value })}><option>GET</option><option>POST</option></select>
          </div>
        </div>
        {s.keys.map((k: Key, i: number) => (
          <div key={i} className="grid grid-cols-[110px_1fr_1fr_auto] gap-2 items-end">
            <div><Label>Joyi</Label>
              <select className="h-10 w-full rounded-md border bg-background px-2" value={k.location} onChange={(e) => setKey(i, { location: e.target.value as Key["location"] })}><option value="header">Sarlavha</option><option value="query">URL parametr</option></select>
            </div>
            <div><Label>Kalit nomi</Label><Input placeholder="Authorization / api_key" value={k.name} onChange={(e) => setKey(i, { name: e.target.value })} /></div>
            <div><Label>Qiymati</Label><Input type="password" placeholder={k.saved ? "•••• saqlangan (o'zgartirish uchun yozing)" : "kalit qiymati"} value={k.value} onChange={(e) => setKey(i, { value: e.target.value })} /></div>
            <Button size="icon" variant="ghost" onClick={() => setS({ ...s, keys: s.keys.filter((_: Key, j: number) => j !== i) })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setS({ ...s, keys: [...s.keys, { location: "header", name: "", value: "" }] })}><Plus className="h-4 w-4" /> Kalit qo'shish</Button>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">2. Ustunlar</h3>
        <p className="text-xs text-muted-foreground">Ustun nomini yoki raqamini kiriting (raqam kiritilsa, u ishlatiladi). Faqat dori nomi, qoldiq va narx olinadi.</p>
        <div className="max-w-[200px]"><Label>Sarlavha qaysi qatorda</Label><Input type="number" min={1} value={s.header_row} onChange={(e) => setS({ ...s, header_row: e.target.value })} /></div>
        {col("Dori nomi", "name_column", "name_col_index", "Наименование")}
        {col("Qoldiq", "stock_column", "stock_col_index", "Остаток")}
        {col("Narx", "price_column", "price_col_index", "Цена")}
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">3. Yangilash vaqti</h3>
        <div className="grid grid-cols-3 gap-2 max-w-md">
          <div><Label>Kun</Label><Input type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} /></div>
          <div><Label>Soat</Label><Input type="number" min={0} value={hours} onChange={(e) => setHours(e.target.value)} /></div>
          <div><Label>Daqiqa</Label><Input type="number" min={0} value={mins} onChange={(e) => setMins(e.target.value)} /></div>
        </div>
        <label className="flex items-center gap-2"><Switch checked={s.enabled} onCheckedChange={(v) => setS({ ...s, enabled: v })} /> Avtomatik yangilash yoqilgan</label>
        <p className="text-xs text-muted-foreground">Oxirgi yangilash: {s.last_run_at ? new Date(s.last_run_at).toLocaleString() : "—"}{s.last_status ? ` · ${s.last_status}` : ""}</p>
        <div className="flex gap-2">
          <Button onClick={save} disabled={busy}>Saqlash</Button>
          <Button variant="outline" onClick={run} disabled={busy}>Hozir yangilash</Button>
        </div>
      </Card>
    </div>
  );
}
