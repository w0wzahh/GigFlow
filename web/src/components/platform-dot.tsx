import { cn } from "@/lib/cn";

/**
 * Platform visual mark — a letter monogram in the platform's brand color.
 * Deliberately generic: we display names and colors, not trademarked logos.
 */
export function PlatformDot({
  name,
  color,
  size = 28,
  className,
}: {
  name: string;
  color?: string | null;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center rounded-md font-semibold text-white shrink-0",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        backgroundColor: color ?? "#64748b",
      }}
    >
      {initials}
    </span>
  );
}
