"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Wallet, Receipt, Gauge, BarChart3, Blocks,
  CalendarDays, SlidersHorizontal, Bell, Settings, Zap, LogOut,
  Menu, X, FlaskConical, MoreHorizontal,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/cn";
import { api } from "@/lib/client";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/offers", label: "Offers", icon: Zap },
  { href: "/earnings", label: "Earnings", icon: Wallet },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/mileage", label: "Mileage", icon: Gauge },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/platforms", label: "Platforms", icon: Blocks },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/rules", label: "Rules", icon: SlidersHorizontal },
];

const MOBILE_PRIMARY = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/offers", label: "Offers", icon: Zap },
  { href: "/earnings", label: "Earnings", icon: Wallet },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function Shell({
  children,
  userName,
  userEmail,
  unreadCount,
  hasDemoData,
}: {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
  unreadCount: number;
  hasDemoData: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const unread = unreadCount;

  // Close the mobile menu on navigation (render-time state adjustment).
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setMenuOpen(false);
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const navItems = (
    <nav className="flex flex-col gap-0.5" aria-label="Primary">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item.href) ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 h-9 text-sm",
            isActive(item.href)
              ? "bg-accent-soft text-accent font-medium"
              : "text-muted hover:text-fg hover:bg-subtle",
          )}
        >
          <item.icon size={16} strokeWidth={2} />
          {item.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh">
      {/* Demo banner */}
      {hasDemoData && (
        <div className="bg-warning/10 border-b border-warning/30 text-warning text-xs px-4 py-1.5 flex items-center gap-2 justify-center">
          <FlaskConical size={13} />
          <span>Demo data is enabled — figures shown are samples, not your real earnings.</span>
          <Link href="/settings/data" className="underline underline-offset-2">Manage</Link>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-border bg-elevated z-30">
        <div className="px-4 h-14 flex items-center border-b border-border">
          <Link href="/dashboard"><Logo /></Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">{navItems}</div>
        <div className="border-t border-border p-3 space-y-0.5">
          <Link
            href="/notifications"
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 h-9 text-sm",
              isActive("/notifications") ? "bg-accent-soft text-accent" : "text-muted hover:text-fg hover:bg-subtle",
            )}
          >
            <Bell size={16} />
            Notifications
            {unread > 0 && (
              <span className="ml-auto text-[10px] bg-accent text-accent-fg rounded-full min-w-4 h-4 px-1 inline-flex items-center justify-center">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 h-9 text-sm",
              isActive("/settings") ? "bg-accent-soft text-accent" : "text-muted hover:text-fg hover:bg-subtle",
            )}
          >
            <Settings size={16} />
            Settings
          </Link>
          <div className="flex items-center gap-2.5 px-3 h-11 mt-1">
            <div className="w-7 h-7 rounded-full bg-accent-soft text-accent inline-flex items-center justify-center text-xs font-semibold shrink-0">
              {(userName || userEmail).slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{userName || "Driver"}</p>
              <p className="text-[11px] text-faint truncate">{userEmail}</p>
            </div>
            <button onClick={logout} aria-label="Sign out" className="text-faint hover:text-fg p-1 rounded">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 border-b border-border bg-elevated/95 backdrop-blur">
        <Link href="/dashboard"><Logo /></Link>
        <div className="flex items-center gap-1">
          <Link href="/notifications" aria-label="Notifications" className="relative p-2 rounded-lg text-muted hover:text-fg">
            <Bell size={18} />
            {unread > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />}
          </Link>
          <button onClick={() => setMenuOpen((v) => !v)} aria-label="Menu" aria-expanded={menuOpen} className="p-2 rounded-lg text-muted hover:text-fg">
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* Mobile slide-down menu */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-14 z-40 border-b border-border bg-elevated shadow-lg p-3 space-y-3">
          {navItems}
          <div className="border-t border-border pt-3 flex items-center justify-between px-3">
            <Link href="/settings" className="flex items-center gap-2 text-sm text-muted">
              <Settings size={16} /> Settings
            </Link>
            <button onClick={logout} className="flex items-center gap-2 text-sm text-muted">
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="lg:pl-60 pb-20 lg:pb-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-elevated/95 backdrop-blur flex justify-around"
        aria-label="Mobile"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {MOBILE_PRIMARY.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 px-3 text-[10px]",
              isActive(item.href) ? "text-accent" : "text-muted",
            )}
          >
            <item.icon size={19} />
            {item.label}
          </Link>
        ))}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className={cn("flex flex-col items-center gap-0.5 py-2 px-3 text-[10px]", menuOpen ? "text-accent" : "text-muted")}
        >
          <MoreHorizontal size={19} />
          More
        </button>
      </nav>
    </div>
  );
}
