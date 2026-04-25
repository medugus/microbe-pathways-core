import type { ReactNode } from "react";

type StoryStageTone = "culture" | "interpret" | "report" | "action";

const toneClasses: Record<StoryStageTone, string> = {
  culture: "border-cyan-200/30 bg-cyan-400/10",
  interpret: "border-teal-200/30 bg-teal-400/10",
  report: "border-blue-200/30 bg-blue-400/10",
  action: "border-emerald-200/30 bg-emerald-400/10",
};

export function StoryStage({
  title,
  caption,
  icon,
  tone,
  delay,
  className = "",
}: {
  title: string;
  caption: string;
  icon: ReactNode;
  tone: StoryStageTone;
  delay: number;
  className?: string;
}) {
  return (
    <article
      className={`story-stage relative overflow-hidden rounded-2xl border border-white/15 bg-slate-950/45 p-3 backdrop-blur-sm ${className}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className={`absolute inset-x-3 top-3 h-1 rounded-full ${toneClasses[tone]} story-stage-accent`} />
      <div className="mt-3 flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${toneClasses[tone]}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/85">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-300/85">{caption}</p>
        </div>
      </div>
    </article>
  );
}
