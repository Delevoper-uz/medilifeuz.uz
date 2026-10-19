import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import loadingLogo from "@/assets/medilife-loading.png.asset.json";
import { cn } from "@/lib/utils";

export function AppLoading({ fullscreen = false, leaving = false }: { fullscreen?: boolean; leaving?: boolean }) {
  return (
    <div role="status" aria-live="polite" aria-label="Yuklanmoqda" className={cn(
      "medilife-loading flex flex-col items-center justify-center gap-6 bg-card text-card-foreground",
      fullscreen ? "fixed inset-0 z-[100] p-6" : "min-h-64 w-full py-8",
      leaving && "medilife-loading-leaving",
    )}>
      <img src={loadingLogo.url} alt="MediLife" width={140} height={161} className="medilife-loading-logo h-40 w-36 object-contain" fetchPriority="high" />
      <div className="flex flex-col items-center gap-3">
        <span aria-hidden="true" className="medilife-loading-spinner h-7 w-7 rounded-full border-[3px] border-primary/15 border-t-primary" />
        <p className="text-sm font-medium text-muted-foreground">Yuklanmoqda…</p>
      </div>
    </div>
  );
}

/** Shows once on startup and during real route transitions, never background polling. */
export function GlobalLoading() {
  const pending = useRouterState({ select: (state) => state.status === "pending" });
  const [startup, setStartup] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let disposed = false;
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (disposed) return;
      setLeaving(true);
      exitTimer = setTimeout(() => { if (!disposed) setStartup(false); }, 300);
    };
    const image = new Image();
    image.src = loadingLogo.url;
    const safetyTimer = setTimeout(finish, 5000);
    image.decode().catch(() => undefined).then(() => {
      if (disposed) return;
      clearTimeout(safetyTimer);
      requestAnimationFrame(finish);
    });
    return () => {
      disposed = true;
      clearTimeout(safetyTimer);
      clearTimeout(exitTimer);
    };
  }, []);

  if (!startup && !pending) return null;
  return <AppLoading fullscreen leaving={startup && leaving && !pending} />;
}