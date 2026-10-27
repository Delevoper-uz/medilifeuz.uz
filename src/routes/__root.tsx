import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  Link,
  ClientOnly,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate, type ErrorComponentProps } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthProvider } from "@/hooks/use-auth";
import { CartProvider } from "@/hooks/use-cart";
import { Toaster } from "@/components/ui/sonner";
import { PresenceTracker } from "@/components/PresenceTracker";
import { AppLoading, GlobalLoading } from "@/components/AppLoading";

import { syncClientLanguage } from "@/lib/i18n";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <p className="mt-4 text-muted-foreground">Sahifa topilmadi.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Bosh sahifa
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Xatolik yuz berdi</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Qayta urinish
          </button>
          <a href="/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
            Bosh sahifa
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MediLife — Onlayn dorixona" },
      { name: "description", content: "MediLife — eng sara va arzon dorilar onlayn dorixonasi. Namangan." },
      { property: "og:title", content: "MediLife — Onlayn dorixona" },
      { property: "og:description", content: "MediLife — eng sara va arzon dorilar onlayn dorixonasi. Namangan." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "MediLife — Onlayn dorixona" },
      { name: "twitter:description", content: "MediLife — eng sara va arzon dorilar onlayn dorixonasi. Namangan." },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AdminHotkey() {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && (e.key === "A" || e.key === "a" || e.code === "KeyA")) {
        e.preventDefault();
        navigate({ to: "/admin" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
  return null;
}

function RootComponent() {
  const [queryClient] = useState(() => new QueryClient());
  const [preferencesReady, setPreferencesReady] = useState(false);
  useEffect(() => {
    syncClientLanguage();
    setPreferencesReady(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key === "medilife-lang") syncClientLanguage();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <GlobalLoading />
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">
              <ClientOnly fallback={<AppLoading />}>
                {preferencesReady ? <Outlet /> : <AppLoading />}
              </ClientOnly>
            </main>
            <Footer />
          </div>
          <PresenceTracker />
          <AdminHotkey />
          <Toaster position="top-right" richColors />

        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
