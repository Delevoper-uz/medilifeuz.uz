import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LoginSchema = z.object({ password: z.string().min(1).max(100) });

/** Parol bilan admin panel tokenini oladi. */
export const adminPanelLogin = createServerFn({ method: "POST" })
  .inputValidator((i) => LoginSchema.parse(i))
  .handler(async ({ data }) => {
    const { createAdminToken } = await import("./admin-panel.server");
    return { token: await createAdminToken(data.password) };
  });

/** Saqlangan token hali amal qiladimi. */
export const adminPanelCheck = createServerFn({ method: "POST" })
  .inputValidator((i: { token?: string } | undefined) => i ?? {})
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./admin-panel.server");
    return { ok: await verifyAdminToken(data.token ?? null) };
  });
