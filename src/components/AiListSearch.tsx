import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ImagePlus, Sparkles, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MedicineCard, type Medicine } from "@/components/MedicineCard";
import { analyzeMedicineImage, getBotSharedList, type AiSearchResult } from "@/lib/ai-search.functions";

/** Ro'yxatni har xil tartibda ko'rsatish uchun aralashtiradi. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/** Dorilar ro'yxati rasmini yuklab, AI orqali tahlil qilish bloki. */
export function AiListSearch() {
  const analyze = useServerFn(analyzeMedicineImage);
  const fromBot = useServerFn(getBotSharedList);
  const [botLoading, setBotLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiSearchResult | null>(null);

  const onFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Faqat rasm yuklash mumkin");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Rasm 5MB dan kichik bo'lishi kerak");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error("Rasm o'qilmadi"));
      fr.readAsDataURL(file);
    });
    setPreview(dataUrl);
    setResult(null);
    setLoading(true);
    try {
      const res = await analyze({ data: { imageDataUrl: dataUrl } });
      setResult(res);
      if (res.ok) toast.success(res.message);
      else toast.warning(res.message, { duration: 8000 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tahlil qilinmadi");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPreview(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="mb-6 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Sparkles className="h-5 w-5 text-primary" />
        <div className="mr-auto">
          <p className="font-semibold">AI bilan ro'yxatdan qidirish</p>
          <p className="text-sm text-muted-foreground">
            Dorilar ro'yxati rasmini yuklang — AI o'qib, bazadagi dorilarni ko'rsatadi.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        <Button onClick={() => inputRef.current?.click()} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          Rasm yuklash
        </Button>
        <Button
          variant="secondary"
          className="gap-2"
          disabled={botLoading}
          onClick={async () => {
            setBotLoading(true);
            try {
              const res = await fromBot();
              setPreview(null);
              setResult(res);
              if (res.found.length) toast.success(res.message);
              else toast.warning(res.message);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Ro'yxat olinmadi");
            } finally {
              setBotLoading(false);
            }
          }}
        >
          {botLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Botdan kelgan ro'yxat
        </Button>
        {(preview || result) && (
          <Button variant="ghost" size="icon" onClick={reset} aria-label="tozalash">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {preview && (
        <div className="mt-4 flex gap-4 items-start">
          <img src={preview} alt="Yuklangan ro'yxat" className="h-28 w-28 rounded-md object-cover border" />
          {loading && <p className="text-sm text-muted-foreground">AI tahlil qilmoqda...</p>}
        </div>
      )}

      {result && !loading && (
        <div className="mt-4 space-y-3">
          {result.names.length > 0 && (
            <p className="text-sm text-muted-foreground">
              AI o'qidi: <span className="text-foreground">{result.names.join(", ")}</span>
            </p>
          )}
          {result.found.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {shuffle(result.found).map((m, i) => (
                <div key={m.id} className="reveal-up" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
                  <MedicineCard m={m as unknown as Medicine} />
                </div>
              ))}
            </div>
          )}
          {result.missing.length > 0 && (
            <p className="text-sm text-muted-foreground">Topilmadi: {result.missing.join(", ")}</p>
          )}
          {!result.ok && result.sentToTelegram && (
            <p className="text-sm text-muted-foreground">
              Rasm operatorlarga yuborildi. Ular ro'yxatni matn ko'rinishida yozib yuborsa, bot topilgan dorilarni
              qaytaradi.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
