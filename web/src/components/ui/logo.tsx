import { cn } from "@/lib/cn";

/** GigFlow wordmark: a forward-motion glyph + wordmark. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 select-none", className)}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 7h11M7 12h11M3 17h11"
          stroke="var(--accent)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M16 8.5 20.5 12 16 15.5"
          stroke="var(--fg)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      {!compact && (
        <span className="font-semibold tracking-tight text-[17px]">
          Gig<span className="text-accent">Flow</span>
        </span>
      )}
      <span className="sr-only">GigFlow</span>
    </span>
  );
}
