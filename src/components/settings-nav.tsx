"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/preferences", label: "Preferences" },
  { href: "/settings/vehicles", label: "Vehicles" },
  { href: "/settings/goals", label: "Goals" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/security", label: "Security" },
  { href: "/settings/privacy", label: "Privacy" },
  { href: "/settings/data", label: "Data" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Settings"
      className="flex md:flex-col gap-1 md:w-44 shrink-0 overflow-x-auto md:overflow-visible pb-1 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 md:[&>*]:rounded-xl md:bg-transparent"
    >
      {ITEMS.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={pathname === i.href ? "page" : undefined}
          className={cn(
            "rounded-full px-3.5 h-9 inline-flex items-center text-sm whitespace-nowrap",
            "transition-[background-color,color] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
            pathname === i.href ? "bg-elevated text-fg font-semibold shadow-[var(--shadow-card)]" : "text-muted hover:text-fg",
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
