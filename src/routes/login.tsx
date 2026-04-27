import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/auth/AuthHero";
import { AuthCard } from "@/auth/AuthCard";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Medugu" },
      { name: "description", content: "Sign in to the Medugu microbiology platform." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  // Never honour a redirect back to /login or /signup — that creates an
  // infinite redirect chain when the guard kicks in before the session loads.
  const rawRedirect = search.redirect ?? "/";
  const redirectTo =
    rawRedirect.startsWith("/login") || rawRedirect.startsWith("/signup") ? "/" : rawRedirect;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Hydrate "remember me" preference + last email from localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("medugu.rememberMe");
      const remembered = stored === null ? true : stored === "1";
      setRememberMe(remembered);
      if (remembered) {
        const lastEmail = window.localStorage.getItem("medugu.lastEmail");
        if (lastEmail) setEmail(lastEmail);
      }
    } catch {
      /* storage unavailable — non-fatal */
    }
  }, []);

  // If already authenticated, leave the login page.
  useEffect(() => {
    if (!loading && session) {
      void navigate({ to: redirectTo });
    }
  }, [loading, session, navigate, redirectTo]);

  const onEmailSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const trimmedEmail = email.trim();

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }

      window.localStorage.setItem("medugu.rememberMe", rememberMe ? "1" : "0");
      if (rememberMe) {
        window.localStorage.setItem("medugu.lastEmail", trimmedEmail);
      } else {
        window.localStorage.removeItem("medugu.lastEmail");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed. Please try again.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: typeof window !== "undefined" ? window.location.origin : undefined,
      });
      if ("error" in result && result.error) {
        setError(result.error.message);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Google sign-in failed. Please try again.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell currentPage="login">
      <AuthCard>
        <h1 className="font-serif text-3xl tracking-tight text-foreground">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Medugu microbiology workflow platform</p>

        <div className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Email verification</p>
          <p className="mt-1">
            New signups are auto-confirmed — you can sign in immediately after creating your
            account. If sign-in fails with an "email not confirmed" message, request a{" "}
            <Link to="/forgot-password" className="underline font-medium text-primary">
              password reset link
            </Link>{" "}
            to confirm your address and set a new password.
          </p>
        </div>

        <form onSubmit={onEmailSignIn} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div
              className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              <p className="font-medium">{error}</p>
              {/email not confirmed|confirm.*email|not.*verified/i.test(error) && (
                <p className="mt-1 text-xs text-destructive/90">
                  Your email hasn't been verified yet. Check your inbox (and spam folder) for the
                  confirmation link, or use{" "}
                  <Link to="/forgot-password" className="underline font-medium">
                    Forgot password
                  </Link>{" "}
                  to receive a fresh link that also confirms your account.
                </p>
              )}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>

          <div className="flex items-center justify-between text-sm">
            <label className="flex cursor-pointer items-center gap-2 text-foreground">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
              />
              <span className="font-medium">Remember me</span>
            </label>
            <Link to="/forgot-password" className="font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
        </form>

        <div className="my-4 flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onGoogle}
          disabled={busy}
        >
          Continue with Google
        </Button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
