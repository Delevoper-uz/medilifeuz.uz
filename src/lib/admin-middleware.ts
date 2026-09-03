import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/** Admin panel so'rovlarini `x-admin-token` sarlavhasi bo'yicha tekshiradi. */
export const requireAdminPanel = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();
  const token = request?.headers?.get("x-admin-token") ?? null;
  const { verifyAdminToken } = await import("./admin-panel.server");
  if (!(await verifyAdminToken(token))) {
    throw new Error("Admin panelga ruxsat yo'q. Parolni qayta kiriting.");
  }
  return next({ context: { adminToken: token as string } });
});
