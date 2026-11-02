// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from 'vite-plugin-pwa';

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  vite: { plugins: [VitePWA({
    strategies: 'generateSW',
    filename: 'sw.js',
    manifest: false,
    injectRegister: null,
    registerType: 'autoUpdate',
    devOptions: { enabled: false },
    workbox: {
      skipWaiting: true,
      clientsClaim: true,
      globPatterns: ['**/*.{js,css,woff2,ico}'],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      navigateFallback: null,
      runtimeCaching: [
        { urlPattern: ({ request, url }) => request.mode === 'navigate' && url.pathname === '/dorilar' && !url.pathname.startsWith('/~oauth'), handler: 'NetworkFirst', options: { cacheName: 'medilife-pages', networkTimeoutSeconds: 3, cacheableResponse: { statuses: [200] } } },
        { urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/assets\/.*[.-][\w-]{8,}\.(js|css|woff2)$/.test(url.pathname), handler: 'CacheFirst', options: { cacheName: 'medilife-hashed-assets', expiration: { maxEntries: 200 } } },
      ],
    },
  })] },
  tanstackStart: {
    server: { entry: "server" },
  },
});
