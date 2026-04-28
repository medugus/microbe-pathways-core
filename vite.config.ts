// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    define: {
      // Allow local `.env` users who provide SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY
      // without VITE_ prefix to sign in on the client.
      // IMPORTANT: only these two public values are injected; service-role keys are never injected.
      "import.meta.env.SUPABASE_URL": JSON.stringify(process.env.SUPABASE_URL ?? ""),
      "import.meta.env.SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
      ),
    },
  },
});
