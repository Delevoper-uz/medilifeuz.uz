import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/** Branded loading: black surface, layered shadows, animated "MED I LIFE" wordmark. */
export function AppLoading({ fullscreen = false, leaving = false }: { fullscreen?: boolean; leaving?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Yuklanmoqda"
      className={cn(
        "medilife-loading flex flex-col items-center justify-center gap-7",
        fullscreen ? "fixed inset-0 z-[100] p-6" : "medilife-loading-inline min-h-64 w-full py-12",
        leaving && "medilife-loading-leaving",
      )}
    >
      <div className="medilife-loading-wordmark" aria-hidden="true">
        <span className="medilife-loading-word-med">MED</span>
        <span className="medilife-loading-word-i">I</span>
        <span className="medilife-loading-word-life">LIFE</span>
      </div>
      <span aria-hidden="true" className="medilife-loading-bar" />
      <p className="medilife-loading-label relative z-[1] text-sm font-medium tracking-wide">Yuklanmoqda…</p>
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
      exitTimer = setTimeout(() => {
        if (!disposed) setStartup(false);
      }, 300);
    };
    const holdTimer = setTimeout(finish, 900);
    return () => {
      disposed = true;
      clearTimeout(holdTimer);
      clearTimeout(exitTimer);
    };
  }, []);

  if (!startup && !pending) return null;
  return <AppLoading fullscreen leaving={startup && leaving && !pending} />;
}
