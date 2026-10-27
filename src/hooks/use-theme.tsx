import { useEffect, useState } from "react";
import { readPreference, savedTheme, writePreference } from "@/lib/preferences";

const KEY = "medilife-theme";

export function useTheme() {
  const [theme, setThemeState] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = savedTheme(readPreference(KEY));
    setThemeState(stored);
    document.documentElement.classList.toggle("dark", stored === "dark");
    const onStorage = (event: StorageEvent) => {
      if (event.key !== KEY) return;
      const next = savedTheme(event.newValue);
      setThemeState(next);
      document.documentElement.classList.toggle("dark", next === "dark");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = (t: "light" | "dark") => {
    setThemeState(t);
    writePreference(KEY, t);
    document.documentElement.classList.toggle("dark", t === "dark");
  };

  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");

  return { theme, setTheme, toggle };
}
