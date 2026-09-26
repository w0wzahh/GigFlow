import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/* ---------- Button ---------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
        size === "sm" && "text-xs px-2.5 h-8",
        size === "md" && "text-sm px-3.5 h-9",
        size === "lg" && "text-sm px-5 h-11",
        variant === "primary" && "bg-accent text-accent-fg hover:opacity-90",
        variant === "secondary" && "bg-subtle text-fg hover:bg-border",
        variant === "outline" && "border border-border-strong bg-elevated hover:bg-subtle",
        variant === "ghost" && "text-muted hover:text-fg hover:bg-subtle",
        variant === "danger" && "bg-negative text-white hover:opacity-90",
        className,
      )}
      {...props}
    />
  );
}

/* ---------- Card ---------- */

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-elevated shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-1 sm:px-5">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pb-4 pt-2 sm:px-5 sm:pb-5", className)} {...props} />;
}

/* ---------- Form controls ---------- */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full h-9 rounded-lg border border-border bg-elevated px-3 text-sm placeholder:text-faint",
          "focus:border-accent focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
          "disabled:opacity-50 disabled:bg-subtle",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm placeholder:text-faint",
          "focus:border-accent focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "w-full h-9 rounded-lg border border-border bg-elevated px-2.5 text-sm",
          "focus:border-accent focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Field({ label, hint, error, children, className }: {
  label: string; hint?: string; error?: string; children: ReactNode; className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="block text-xs font-medium text-muted mb-1.5">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-faint mt-1">{hint}</span>}
      {error && <span className="block text-xs text-negative mt-1" role="alert">{error}</span>}
    </label>
  );
}

/* ---------- Badge ---------- */

export function Badge({ tone = "neutral", className, children }: {
  tone?: "neutral" | "accent" | "positive" | "negative" | "warning";
  className?: string; children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        tone === "neutral" && "bg-subtle text-muted",
        tone === "accent" && "bg-accent-soft text-accent",
        tone === "positive" && "bg-[color-mix(in_srgb,var(--positive)_14%,transparent)] text-positive",
        tone === "negative" && "bg-[color-mix(in_srgb,var(--negative)_14%,transparent)] text-negative",
        tone === "warning" && "bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] text-warning",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------- Progress ---------- */

export function Progress({ value, className }: { value: number; className?: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("h-1.5 rounded-full bg-subtle overflow-hidden", className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ---------- Skeleton ---------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-subtle", className)} />;
}

/* ---------- Empty state ---------- */

export function EmptyState({ icon, title, body, action }: {
  icon?: ReactNode; title: string; body?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6">
      {icon && <div className="text-faint mb-3">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {body && <p className="text-xs text-muted mt-1 max-w-xs">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- Stat ---------- */

export function Stat({ label, value, sub, trend }: {
  label: string; value: ReactNode; sub?: ReactNode; trend?: "up" | "down";
}) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className={cn(
        "text-xl font-semibold tracking-tight mt-0.5 tabular-nums",
        trend === "up" && "text-positive",
        trend === "down" && "text-negative",
      )}>{value}</p>
      {sub && <p className="text-xs text-faint mt-0.5">{sub}</p>}
    </div>
  );
}
