import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { presenceHeartbeat } from "@/lib/presence.functions";

function activityFor(path: string): string {
  if (path === "/") return "Asosiy sahifada";
  if (path.startsWith("/dorilar")) return "Dorilarni ko'rmoqda";
  if (path.startsWith("/savatcha")) return "Savatda dori ko'rmoqda";
  if (path.startsWith("/buyurtmalarim")) return "Buyurtmalarini ko'rmoqda";
  if (path.startsWith("/filiallar")) return "Filiallarni ko'rmoqda";
  if (path.startsWith("/yangiliklar")) return "Yangiliklarni o'qimoqda";
  if (path.startsWith("/profil")) return "Profilida";
  if (path.startsWith("/admin")) return "Admin panelda";
  if (path.startsWith("/login") || path.startsWith("/register")) return "Kirish sahifasida";
  return path;
}

export function PresenceTracker() {
  const { user, fullName, phone } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const latest = useRef({ pathname, fullName, phone });
  latest.current = { pathname, fullName, phone };

  useEffect(() => {
    if (!user) return;
    let stopped = false;
    const ping = () => {
      if (stopped) return;
      const { pathname: p, fullName: n, phone: ph } = latest.current;
      const activity = pathname.startsWith("/savatcha") && typeof window !== "undefined" && window.location.hash.includes("checkout")
        ? "Buyurtma rasmiylashtirmoqda"
        : activityFor(p);
      void presenceHeartbeat({
        data: {
          path: p,
          activity,
          phone_number: ph ?? user.phone ?? null,
          full_name: n ?? null,
        },
      }).catch(() => {});
    };
    ping();
    const id = setInterval(ping, 60_000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [user, pathname]);

  return null;
}
