/** Admin panel uchun parol + imzolangan token (faqat server tomonda). */

const TTL_MS = 12 * 60 * 60 * 1000; // 12 soat

function secretKey(): string {
  return (
    process.env["ADMIN_PANEL_SECRET"] ??
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
    "medilife-fallback-secret"
  );
}

function adminPassword(): string {
  return process.env["ADMIN_PANEL_PASSWORD"] ?? "123654";
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64url(new Uint8Array(sig));
}

export async function createAdminToken(password: string): Promise<string> {
  if (password.trim() !== adminPassword()) throw new Error("Parol noto'g'ri");
  const exp = String(Date.now() + TTL_MS);
  return `${exp}.${await sign(exp)}`;
}

export async function verifyAdminToken(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Date.now()) return false;
  return (await sign(exp)) === sig;
}
