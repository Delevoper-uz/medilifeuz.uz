import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/price-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { runIfDue } = await import("@/lib/price-sync.server");
        return Response.json({ status: await runIfDue() });
      },
    },
  },
});
