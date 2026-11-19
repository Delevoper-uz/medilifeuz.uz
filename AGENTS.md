# Project rules

- Use AppLoading for branded loading states and GlobalLoading in the root layout for startup and route transitions; background polling must not block the page.
- Restore browser preferences from effects via the shared preference helpers, never during module evaluation, to keep SSR and hydration consistent.
- Keep downloadable self-hosting files outside the live app graph; the live deployment must continue using its existing integrations until an explicit cutover.
- Operator deliveries use per-request random capabilities, server-only rows and row-locked operator actions; never use IP addresses to identify the delivery recipient or share them with operators.
- Visitor and order network/device metadata is server-only, exposed only through verified admin-panel functions; IP groups describe shared network addresses, not verified people. Trust Cloudflare client-IP headers only in the published Worker, never arbitrary forwarded headers in development.
- Welcome effects use an atomic server-only IP claim, with a browser fallback only when trusted IP is unavailable; a bounded CSS particle pool and reduced-motion support prevent unbounded rendering work.
- Cart line identity includes source and request ID so operator deliveries cannot overwrite customer selections or be applied twice.
- Offline mode caches only the public catalogue in IndexedDB and uses a guarded vite-plugin-pwa generated worker on published origins; private data and preview workers are excluded.
- Order routing uses only branch_locations rows joined to real branches; private Telegram destinations stay server-only, and atomic admin saves keep branch names and coordinates consistent.
- Public random browsing shares RandomMedicines and uses language-filtered indexed UUID seeks, not exact counts or deep offsets, to keep large catalogue loading bounded.