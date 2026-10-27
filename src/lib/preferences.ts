export type Language = "uz" | "uz_cyrl";
export type Theme = "light" | "dark";

export function readPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The page still works when storage is unavailable.
  }
}

export function savedLanguage(value: string | null): Language {
  return value === "uz" ? "uz" : "uz_cyrl";
}

export function savedTheme(value: string | null): Theme {
  return value === "dark" ? "dark" : "light";
}