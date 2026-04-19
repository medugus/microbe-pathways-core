// Patches global fetch so that calls to TanStack server functions automatically
// include the current Supabase access token as a Bearer header. This is what
// `requireSupabaseAuth` middleware on the server side reads.
//
// Server-fn requests target paths under `/_serverFn/*`. We only attach the
// header for same-origin requests to that prefix and only when Authorization
// has not already been set explicitly.

import { supabase } from "@/integrations/supabase/client";

let installed = false;

export function installServerFnAuth(): void {
  if (installed) return;
  if (typeof window === "undefined") return;
  installed = true;

  const origFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const isServerFn = url.includes("/_serverFn/");
      if (!isServerFn) return origFetch(input, init);

      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      if (!headers.has("authorization")) {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) headers.set("authorization", `Bearer ${token}`);
      }
      return origFetch(input, { ...init, headers });
    } catch {
      return origFetch(input, init);
    }
  };
}
