import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { pollOperatorRequest } from "@/lib/operator.functions";
import { OPERATOR_NOTICE_MS, type DeliveryKey } from "@/lib/operator-model";
import { readPreference, writePreference } from "@/lib/preferences";
import { useCart } from "@/hooks/use-cart";
const Context = createContext<{ track: (key: DeliveryKey) => void } | null>(null);
const KEY = "medilife-operator-requests";
export function OperatorDeliveryProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<DeliveryKey[]>([]);
  const [ready, setReady] = useState(false);
  const poll = useServerFn(pollOperatorRequest);
  const { receiveOperator } = useCart();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const audio = useRef<AudioContext | null>(null);
  useEffect(() => {
    try { const data = JSON.parse(readPreference(KEY) || "[]"); if (Array.isArray(data)) setRequests(data.filter(k => typeof k?.id === "string" && typeof k?.secret === "string")); } catch {}
    setReady(true);
    const unlock = () => { try { audio.current ??= new AudioContext(); void audio.current.resume(); } catch {} };
    document.addEventListener("pointerdown", unlock);
    return () => { document.removeEventListener("pointerdown", unlock); void audio.current?.close(); };
  }, []);
  useEffect(() => { if (ready) writePreference(KEY, JSON.stringify(requests)); }, [requests, ready]);
  const track = useCallback((key: DeliveryKey) => setRequests(prev => prev.some(r => r.id === key.id) ? prev : [...prev, key]), []);
  useEffect(() => {
    if (!ready || !requests.length) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      for (const key of requests) {
        try {
          const result = await poll({ data: key });
          if (stopped || result.status !== "sent") continue;
          receiveOperator(result.items.map(m => ({ ...m, name: i18n.language === "uz_cyrl" ? m.name_cyrl || m.name : m.name })), key.id);
          setRequests(prev => prev.filter(r => r.id !== key.id));
          const ctx = audio.current;
          if (ctx && ctx.state === "running") {
            const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
            oscillator.frequency.value = 1046;
            gain.gain.setValueAtTime(0.2, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            oscillator.connect(gain).connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + 0.5);
          }
          toast.success(i18n.language === "uz_cyrl" ? "Оператор томонидан сизнинг дориларингиз рўйхати етиб келди" : "Operator tomonidan sizning dorilaringiz ro‘yxati yetib keldi", { duration: OPERATOR_NOTICE_MS, id: key.id });
          void navigate({ to: "/savatcha" });
        } catch { /* Keep pending deliveries for the next connection attempt. */ }
      }
      if (!stopped) timer = setTimeout(check, 2000);
    };
    void check();
    return () => { stopped = true; clearTimeout(timer); };
  }, [requests, ready, poll, receiveOperator, navigate, i18n]);
  return <Context.Provider value={{ track }}>{children}</Context.Provider>;
}
export function useOperatorDelivery() { const ctx = useContext(Context); if (!ctx) throw new Error("Operator delivery context missing"); return ctx; }