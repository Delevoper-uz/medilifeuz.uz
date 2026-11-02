import { AppLoading } from "@/components/AppLoading";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MedicineCard, type Medicine } from "@/components/MedicineCard";
import { AiListSearch } from "@/components/AiListSearch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SEARCH_PAGE_SIZE } from "@/lib/operator-model";
import { useOfflineMode } from '@/components/OfflineMode';
import { offlineMedicines, saveOfflineMedicines } from '@/lib/offline-catalogue';


export const Route = createFileRoute("/dorilar")({
  component: MedicinesPage,
  head: () => ({ meta: [
    { title: "Dorilar — MediLife" },
    { name: "description", content: "MediLife dorilar katalogi: nomi va narxi bo‘yicha qidirish." },
    { property: "og:title", content: "Dorilar — MediLife" },
    { property: "og:description", content: "MediLife dorilar katalogi: nomi va narxi bo‘yicha qidirish." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

const PAGE_SIZE = SEARCH_PAGE_SIZE;

/** So'rovni PostgREST ilike patterniga aylantiradi (maxsus belgilarni tozalaydi). */
function tokens(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[,()%*"']/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
}

function MedicinesPage() {
  const { t, i18n } = useTranslation();
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [sort, setSort] = useState<"az" | "za" | "price-asc" | "price-desc" | "random">("random");
  const [page, setPage] = useState(0);
  const { offline } = useOfflineMode();
  const [cacheRevision, setCacheRevision] = useState(0);
  useEffect(() => {
    const changed = () => setCacheRevision(v => v + 1);
    window.addEventListener('medilife-catalogue-saved', changed);
    return () => window.removeEventListener('medilife-catalogue-saved', changed);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDq(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);

  const currentLang: "latin" | "cyrillic" = i18n.language === "uz_cyrl" ? "cyrillic" : "latin";
  useEffect(() => setPage(0), [dq, minPrice, maxPrice, sort, currentLang]);

  const { data: result, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["medicines-search", currentLang, dq, minPrice, maxPrice, sort, page, offline, offline ? cacheRevision : 0],
    networkMode: 'always',
    placeholderData: keepPreviousData,
    staleTime: sort === "random" ? 0 : 2 * 60 * 1000,
    retry: 3,
    retryDelay: (a) => Math.min(1000 * 2 ** a, 5000),
    queryFn: async () => {
      const min = Number(minPrice) || 0;
      const max = Number(maxPrice) || 0;
      if (offline) return offlineMedicines(currentLang, dq, min, max, sort, page, PAGE_SIZE);

      const run = async (withLang: boolean) => {
        let query = supabase.from("medicines").select("*", { count: "exact" });
        if (withLang) query = query.eq("language", currentLang);
        for (const tok of tokens(dq)) {
          query = query.or(`name.ilike.%${tok}%,name_cyrl.ilike.%${tok}%`);
        }
        if (min > 0) query = query.gte("price", min);
        if (max > 0) query = query.lte("price", max);
        if (sort === "price-asc") query = query.order("price", { ascending: true });
        else if (sort === "price-desc") query = query.order("price", { ascending: false });
        else if (sort === "random") query = query.order("id", { ascending: dq ? true : Math.random() < 0.5 });
        else query = query.order(currentLang === "cyrillic" ? "name_cyrl" : "name", { ascending: sort === "az" });
        query = query.order("id", { ascending: true });
        let offset = page * PAGE_SIZE;
        if (sort === "random" && !dq) {
          let cq = supabase.from("medicines").select("id", { count: "exact", head: true });
          if (withLang) cq = cq.eq("language", currentLang);
          for (const tok of tokens(dq)) cq = cq.or(`name.ilike.%${tok}%,name_cyrl.ilike.%${tok}%`);
          if (min > 0) cq = cq.gte("price", min);
          if (max > 0) cq = cq.lte("price", max);
          const { count } = await cq;
          const total = count ?? 0;
          if (total > PAGE_SIZE) offset = Math.floor(Math.random() * (total - PAGE_SIZE));
        }
        const { data, error, count } = await query.range(offset, offset + PAGE_SIZE - 1);
        if (error) { window.dispatchEvent(new Event('medilife-network-failed')); throw new Error(error.message); }
        void saveOfflineMedicines((data ?? []) as Medicine[]).catch(() => undefined);
        return { rows: (data ?? []) as Medicine[], total: count ?? 0 };
      };

      const primary = await run(true);
      const resolved = primary.total ? primary : await run(false);
      const rows = resolved.rows;

      // Bir xil dorilarni (nomi + narxi bir xil) faqat bir marta ko'rsatamiz
      const seen = new Set<string>();
      const unique: Medicine[] = [];
      for (const m of rows) {
        const key = `${(m.name ?? "").toLowerCase().replace(/\s+/g, " ").trim()}|${(m as { name_cyrl?: string | null }).name_cyrl?.toLowerCase().replace(/\s+/g, " ").trim() ?? ""}|${m.price}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(m);
      }
      // "Aralash" tanlansa har xil tartibda ko'rsatamiz
      if (sort === "random") {
        for (let i = unique.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [unique[i], unique[j]] = [unique[j] as Medicine, unique[i] as Medicine];
        }
      }
      return { rows: unique, total: resolved.total };
    },
  });
  const filtered = result?.rows ?? [];
  const total = result?.total ?? 0;



  return (
    <div className="container mx-auto px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <h1 className="text-4xl font-bold">{t("medicines.title")}</h1>
        <Input placeholder={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>
      {!offline && <AiListSearch />}

      <div className="flex flex-wrap items-center gap-2 mb-6 p-3 rounded-lg border bg-card">
        <span className="text-sm font-medium">Narx:</span>
        <Input type="number" placeholder="1 000" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="w-28" />
        <span className="text-muted-foreground">—</span>
        <Input type="number" placeholder="100 000" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-28" />
        <span className="text-sm text-muted-foreground">so'm</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm font-medium">Saralash:</span>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="random">Aralash</SelectItem>
              <SelectItem value="az">A → Z</SelectItem>
              <SelectItem value="za">Z → A</SelectItem>
              <SelectItem value="price-asc">Narx: arzon → qimmat</SelectItem>
              <SelectItem value="price-desc">Narx: qimmat → arzon</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {isLoading ? (
        <AppLoading />
      ) : isError ? (
        <div className="text-muted-foreground">
          <p>Ma'lumot yuklanmadi. Internetni tekshirib, qayta urinib ko'ring.</p>
          <Button variant="outline" className="mt-2" onClick={() => refetch()}>Qayta yuklash</Button>
        </div>
      ) : filtered.length === 0 ? (

        <p className="text-muted-foreground">{offline ? (i18n.language === 'uz_cyrl' ? 'Сақланган дорилар топилмади.' : 'Saqlangan dorilar topilmadi.') : t("medicines.empty")}</p>
      ) : (
        <>
          <div className="text-xs text-muted-foreground mb-3">
            Topildi: {total.toLocaleString("uz-UZ")} ta
            {isFetching ? " · yuklanmoqda…" : ""}
          </div>
          {(offline || sort !== "random" || dq) && total > PAGE_SIZE && <div className="flex items-center justify-center gap-3 mt-6">
            <Button variant="outline" disabled={page === 0 || isFetching} onClick={() => setPage(p => p - 1)}>{i18n.language === "uz_cyrl" ? "Олдинги" : "Oldingi"}</Button>
            <span>{page + 1}</span>
            <Button variant="outline" disabled={(page + 1) * PAGE_SIZE >= total || isFetching} onClick={() => setPage(p => p + 1)}>{i18n.language === "uz_cyrl" ? "Кейинги" : "Keyingi"}</Button>
          </div>}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((m, i) => (
              <div key={m.id} className="reveal-up" style={{ animationDelay: `${Math.min(i, 10) * 50}ms` }}>
                <MedicineCard m={m} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
