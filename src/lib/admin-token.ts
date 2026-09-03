import { createMiddleware } from "@tanstack/react-start";

export const ADMIN_TOKEN_KEY = "medilife-admin-token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Admin tokenini har bir server funksiya chaqiruviga qo'shadi. */
export const attachAdminToken = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const token = getAdminToken();
  return next({ headers: token ? { "x-admin-token": token } : {} });
});
