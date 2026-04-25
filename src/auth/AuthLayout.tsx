import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AuthStoryPanel } from "@/auth/AuthStoryPanel";

type AuthRoute = "login" | "signup" | "forgot" | "reset";

function AuthNavTabs({ currentPage }: { currentPage?: AuthRoute }) {
  const tabs: Array<{ key: AuthRoute; label: string; to: string }> = [
    { key: "login", label: "Sign in", to: "/login" },
    { key: "signup", label: "Create account", to: "/signup" },
    { key: "forgot", label: "Reset password", to: "/forgot-password" },
  ];

  return (
    <div className="mb-5 grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/40 p-1 text-xs sm:text-sm">
      {tabs.map((tab) => {
        const active = currentPage === tab.key;
        return (
          <Link
            key={tab.key}
            to={tab.to}
            className={`rounded-md px-2 py-1.5 text-center font-medium transition-colors ${
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export function AuthShell({
  children,
  currentPage,
}: {
  children: ReactNode;
  currentPage?: AuthRoute;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.18fr_1fr] xl:grid-cols-[1.22fr_1fr]">
      <AuthStoryPanel />
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:px-6">
        <div className="w-full max-w-md">
          <AuthNavTabs currentPage={currentPage} />
          {children}
        </div>
      </main>
    </div>
  );
}
