import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ImagePlus, Sparkles, Loader2, X, Send, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MedicineCard, type Medicine } from "@/components/MedicineCard";
import {
  analyzeMedicineImage,
  getBotSharedList,
  sendPrescriptionToOperators,
  type AiGroup,
  type AiSearchResult,
} from "@/lib/ai-search.functions";

/** "Ha / Yo'q" so'rab, raqam bo'yicha tanlash bloki (har bir retsept qatori uchun). */
function GroupPicker({ index, group }: { index: number; group: AiGroup }) {
  const [answer, setAnswer] = useState<"idle" | "yes" | "no">("idle");
  const [picked, setPicked] = useState<number[]>([]);

  if (!group.candidates.length) {
    return (
      <div className="rounded-md border p-3 text-sm">
        <p className="font-medium">
          {index}. {group.query}
        </p>
        <p className="text-muted-foreground">Bazada o'xshash dori topilmadi.</p>
      </div>
    );
  }

  const toggle = (n: number) => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));

  return (
    <div className="rounded-md border p-3 space-y-3 reveal-up">
      <p className="font-medium">
        {index}. Retseptda: <span className="text-primary">{group.query}</span>
        {!group.exact && <span className="ml-2 text-xs text-muted-foreground">(o'xshash nomlar)</span>}
      </p>
      <ol className="space-y-1 text-sm">
        {group.candidates.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2">
            {answer === "yes" ? (
              <Button
                size="sm"
                variant={picked.includes(i) ? "default" : "outline"}
                className="h-7 w-9 shrink-0 px-0"
                onClick={() => toggle(i)}
              >
                {picked.includes(i) ? <Check className="h-4 w-4" /> : i + 1}
              </Button>
            ) : (
              <span className="w-6 shrink-0 text-muted-foreground">{i + 1}.</span>
            )}
            <span className="min-w-0 break-words">
              {c.name} — {Number(c.price).toLocaleString("uz-UZ")} so'm
            </span>
          </li>
        ))}
      </ol>

      {answer === "idle" && (
        <div className="space-y-2">
          <p className="text-sm">Sizning o'ylashingizcha, bu yerda siz qidirayotgan dori bormi?</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setAnswer("yes")}>
              Ha, bor
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAnswer("no")}>
              Yo'q
            </Button>
          </div>
        </div>
      )}
      {answer === "yes" && picked.length === 0 && (
        <p className="text-sm text-muted-foreground">Qaysi raqamda turganini belgilang.</p>
      )}
      {answer === "no" && (
        <p className="text-sm text-muted-foreground">
          Tushunarli.{" "}
          <button className="underline" onClick={() => setAnswer("idle")}>
            Qayta ko'rish
          </button>
        </p>
      )}
      {picked.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {picked.map((i) => {
            const m = group.candidates[i];
            return m ? <MedicineCard key={m.id} m={m as unknown as Medicine} /> : null;
          })}
        </div>
      )}
    </div>
  );
}

/** Retsept / dorilar ro'yxati rasmini AI orqali tahlil qilish bloki. */
export function AiListSearch() {
  const analyze = useServerFn(analyzeMedicineImage);
  const fromBot = useServerFn(getBotSharedList);
  const toOperators = useServerFn(sendPrescriptionToOperators);
  const [botLoading, setBotLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiSearchResult | null>(null);

  /** Rasmni kichraytirib yuboramiz — AI tezroq javob beradi. */
  const shrink = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 1600;
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("Rasm o'qilmadi"));
      img.src = url;
    });

  const onFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Faqat rasm yuklash mumkin");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Rasm 15MB dan kichik bo'lishi kerak");
      return;
    }
    let dataUrl: string;
    try {
      dataUrl = await shrink(file);
    } catch {
      toast.error("Rasm o'qilmadi");
      return;
    }
    setPreview(dataUrl);
    setResult(null);
    setSent(false);
    setLoading(true);
    try {
      const res = await analyze({ data: { imageDataUrl: dataUrl } });
      setResult(res);
      if (res.ok) toast.success(res.message);
      else toast.warning(res.message, { duration: 6000 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tahlil qilinmadi");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPreview(null);
    setResult(null);
    setSent(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const sendToOperators = async () => {
    if (!preview) return;
    setSending(true);
    try {
      const r = await toOperators({ data: { imageDataUrl: preview, note: result?.missing.join(", ") } });
      if (r.ok) {
        setSent(true);
        toast.success("Rasm operatorlarga yuborildi");
      } else toast.error("Yuborib bo'lmadi");
    } catch {
      toast.error("Yuborib bo'lmadi");
    } finally {
      setSending(false);
    }
  };

  const showOperatorBtn = !!preview && !!result && (!result.ok || result.missing.length > 0);

  return (
    <div className="mb-6 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Sparkles className="h-5 w-5 text-primary" />
        <div className="mr-auto">
          <p className="font-semibold">AI bilan retseptdan qidirish</p>
          <p className="text-sm text-muted-foreground">
            Retsept yoki dorilar ro'yxati rasmini yuklang — AI bir necha soniyada o'qib, mos dorilarni ko'rsatadi.
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
              if (res.ok) toast.success(res.message);
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
          <img src={preview} alt="Yuklangan retsept" className="h-28 w-28 rounded-md object-cover border" />
          {loading && <p className="text-sm text-muted-foreground">AI retseptni o'qimoqda...</p>}
        </div>
      )}

      {result && !loading && (
        <div className="mt-4 space-y-3">
          {!result.ok && <p className="text-sm text-muted-foreground">{result.message}</p>}
          {result.groups.map((g, i) => (
            <GroupPicker key={`${g.query}-${i}`} index={i + 1} group={g} />
          ))}
          {showOperatorBtn && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <p className="text-sm text-muted-foreground">Kerakli dori topilmadimi?</p>
              <Button size="sm" variant="outline" className="gap-2" disabled={sending || sent} onClick={sendToOperators}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sent ? "Operatorga yuborildi" : "Operatorga yuborish"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
