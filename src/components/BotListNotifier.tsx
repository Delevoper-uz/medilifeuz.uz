import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { Card } from "@/components/ui/card";
import { adminLatestBotList } from "@/lib/admin-botlist.functions";

function playSound() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.25].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i ? 1046 : 784;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.4);
    });
  } catch {
    /* ignore */
  }
}

/** Admin panelda: guruhdan yangi ro'yxat kelsa ovoz + bildirishnoma, tanlangan dorilarni ko'rsatadi. */
export function BotListNotifier() {
  const fn = useServerFn(adminLatestBotList);
  const { data } = useQuery({ queryKey: ["admin-bot-list"], queryFn: () => fn(), refetchInterval: 5000 });
  const lastId = useRef<string | null | undefined>(undefined);
  const [fresh, setFresh] = useState(false);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
  }, []);

  useEffect(() => {
    if (data === undefined) return;
    const id = data?.id ?? null;
    if (lastId.current !== undefined && id && id !== lastId.current) {
      playSound();
      setFresh(true);
      toast.success("🔔 Sizga ro'yxat keldi!");
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("MediLife", { body: `Sizga ro'yxat keldi (${data?.items.length ?? 0} ta dori)` });
      }
    }
    lastId.current = id;
  }, [data]);

  if (!data) return null;
  return (
    <Card className={`p-4 mb-6 ${fresh ? "border-primary ring-2 ring-primary/40" : ""}`} onClick={() => setFresh(false)}>
      <div className="flex items-center gap-2 font-semibold mb-2">
        <Bell className="h-4 w-4 text-primary" /> Guruhdan kelgan ro'yxat
        <span className="text-xs font-normal text-muted-foreground">{new Date(data.created_at).toLocaleString()}</span>
      </div>
      <ol className="list-decimal pl-5 space-y-1 text-sm">
        {data.items.map((m, i) => (
          <li key={i}>
            {m.name}
            {m.name_cyrl ? ` (${m.name_cyrl})` : ""}
            {m.price != null ? ` — ${m.price.toLocaleString()} so'm` : ""}
          </li>
        ))}
      </ol>
    </Card>
  );
}
