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
        "inline-flex items-center justify-center gap-1.5 font-medium rounded-xl whitespace-nowrap",
        "transition-[transform,background-color,opacity,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
        "active:scale-[0.96] disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" && "text-xs px-3 h-8",
        size === "md" && "text-sm px-4 h-10",
        size === "lg" && "text-[15px] px-6 h-12",
        variant === "primary" && "bg-accent text-accent-fg shadow-[var(--shadow-card)] hover:brightness-105 hover:shadow-[var(--shadow-raised)]",
        variant === "secondary" && "bg-subtle text-fg hover:bg-border",
        variant === "outline" && "border border-border-strong bg-elevated hover:bg-subtle shadow-[var(--shadow-card)]",
        variant === "ghost" && "text-accent hover:bg-accent-soft",
        variant === "danger" && "bg-negative text-white hover:brightness-105",
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
        "rounded-2xl border border-border bg-elevated shadow-[var(--shadow-card)]",
        className,
      )}
      {...props}
    />
  );
}

/** Card with iOS-style press feedback — use for tappable cards. */
export function PressableCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-elevated shadow-[var(--shadow-card)]",
        "transition-[transform,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
        "hover:shadow-[var(--shadow-raised)] active:scale-[0.985]",
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
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pb-4 pt-2 sm:px-5 sm:pb-5", className)} {...props} />;
}

/* ---------- Form controls (iOS filled-field style) ---------- */

const fieldBase =
  "w-full rounded-xl border border-transparent bg-subtle px-3.5 text-[15px] placeholder:text-faint " +
  "transition-[background-color,border-color,box-shadow] duration-200 " +
  "focus:border-accent focus:bg-elevated focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(fieldBase, "h-10", "disabled:opacity-50", className)}
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
        className={cn(fieldBase, "py-2.5", className)}
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
        className={cn(fieldBase, "h-10", className)}
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
      <span className="block text-[13px] font-medium text-muted mb-1.5">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-faint mt-1.5">{hint}</span>}
      {error && <span className="block text-xs text-negative mt-1.5 animate-fade-up" role="alert">{error}</span>}
    </label>
  );
}

/* ---------- Badge (iOS pill) ---------- */

export function Badge({ tone = "neutral", className, children }: {
  tone?: "neutral" | "accent" | "positive" | "negative" | "warning";
  className?: string; children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-tight",
        tone === "neutral" && "bg-subtle text-muted",
        tone === "accent" && "bg-accent-soft text-accent",
        tone === "positive" && "bg-[color-mix(in_srgb,var(--positive)_15%,transparent)] text-positive",
        tone === "negative" && "bg-[color-mix(in_srgb,var(--negative)_15%,transparent)] text-negative",
        tone === "warning" && "bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-warning",
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
    <div className={cn("h-2 rounded-full bg-subtle overflow-hidden", className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ---------- Switch (iOS-style toggle) ---------- */

export function Switch({ checked, onChange, label }: {
  checked: boolean; onChange: (v: boolean) => void; label?: string;
}) {
  return (
    <button
      type="button"
      role="switch" aria-checked={checked} aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[26px] w-[46px] shrink-0 items-center rounded-full transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        checked ? "bg-accent" : "bg-border-strong",
      )}
    >
      <span
        className={cn(
          "absolute left-[2px] h-[22px] w-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]",
          "transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
          checked && "translate-x-[20px]",
        )}
      />
    </button>
  );
}

/* ---------- Skeleton ---------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} />;
}

/* ---------- Empty state ---------- */

export function EmptyState({ icon, title, body, action }: {
  icon?: ReactNode; title: string; body?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6 animate-fade-up">
      {icon && <div className="text-faint mb-3">{icon}</div>}
      <p className="text-[15px] font-medium">{title}</p>
      {body && <p className="text-[13px] text-muted mt-1.5 max-w-xs leading-relaxed">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------- Stat ---------- */

export function Stat({ label, value, sub, trend }: {
  label: string; value: ReactNode; sub?: ReactNode; trend?: "up" | "down";
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={cn(
        "text-[22px] font-bold tracking-tight mt-1 tabular-nums leading-tight",
        trend === "up" && "text-positive",
        trend === "down" && "text-negative",
      )}>{value}</p>
      {sub && <p className="text-[11px] text-faint mt-1">{sub}</p>}
    </div>
  );
}
