import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { mergeOperatorItems, cartEntryKey, type OperatorMedicine } from "@/lib/operator-model";
import { writePreference } from "@/lib/preferences";

export type CartItem = {
  id: string;
  name: string;
  price: number;
  unit: string;
  image_url: string | null;
  quantity: number;
  source?: "customer" | "operator";
  requestId?: string;
};

type CartCtx = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  total: number;
  count: number;
  receiveOperator: (medicines: OperatorMedicine[], requestId: string) => void;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "medilife-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        // Paket to'lovi kabi mahsulot bo'lmagan yozuvlarni chiqarib tashlash
        setItems(parsed.filter((x) => !/^0*\s*paket/i.test((x.name ?? "").trim())));
      }
    } catch {}
    setReady(true);
  }, []);


  useEffect(() => {
    if (ready) writePreference(KEY, JSON.stringify(items));
  }, [items, ready]);

  const receiveOperator = useCallback((medicines: OperatorMedicine[], requestId: string) => {
    setItems(prev => mergeOperatorItems(prev, medicines, requestId));
  }, []);

  const add: CartCtx["add"] = (item) => {
    setItems((prev) => {
      const found = prev.find((x) => cartEntryKey(x) === cartEntryKey({ ...item, quantity: 1 }));
      if (found) return prev.map((x) => (cartEntryKey(x) === cartEntryKey(found) ? { ...x, quantity: x.quantity + 1 } : x));
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const remove: CartCtx["remove"] = (id) => {
    setItems((prev) => {
      const found = prev.find((x) => cartEntryKey(x) === id || (x.id === id && x.source !== "operator"));
      if (!found) return prev;
      if (found.quantity <= 1) return prev.filter((x) => cartEntryKey(x) !== cartEntryKey(found));
      return prev.map((x) => (cartEntryKey(x) === cartEntryKey(found) ? { ...x, quantity: x.quantity - 1 } : x));
    });
  };

  const setQty: CartCtx["setQty"] = (id, qty) => {
    setItems((prev) => (qty <= 0 ? prev.filter((x) => cartEntryKey(x) !== id) : prev.map((x) => (cartEntryKey(x) === id ? { ...x, quantity: qty } : x))));
  };

  const clear = () => setItems([]);
  const total = items.reduce((s, x) => s + x.price * x.quantity, 0);
  const count = items.reduce((s, x) => s + x.quantity, 0);

  return <Ctx.Provider value={{ items, add, remove, setQty, clear, total, count, receiveOperator }}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
