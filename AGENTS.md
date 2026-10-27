# Project rules

- Use AppLoading for branded loading states and GlobalLoading in the root layout for startup and route transitions; background polling must not block the page.
- Restore browser preferences from effects via the shared preference helpers, never during module evaluation, to keep SSR and hydration consistent.
- Keep downloadable self-hosting files outside the live app graph; the live deployment must continue using its existing integrations until an explicit cutover.