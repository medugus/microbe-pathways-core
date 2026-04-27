import type { ReactNode } from "react";

export function AuthCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border bg-card p-7 shadow-lg ${className}`}>
      {children}
    </div>
  );
}
