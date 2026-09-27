"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Wallet, Receipt, Gauge, BarChart3, Blocks,
  CalendarDays, SlidersHorizontal, Bell, Settings, Zap, LogOut,
  Menu, X, MoreHorizontal,
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

const navLink =
  "flex items-center gap-2.5 rounded-xl px-3 h-10 text-sm " +
  "transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]";

export function Shell({
  children,
  userName,
  userEmail,
  unreadCount,
}: {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
  unreadCount: number;
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
            navLink,
            isActive(item.href)
              ? "bg-accent-soft text-accent font-semibold"
              : "text-muted hover:text-fg hover:bg-subtle",
          )}
        >
          <item.icon size={17} strokeWidth={isActive(item.href) ? 2.2 : 1.8} />
          {item.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-border glass z-30">
        <div className="px-5 h-16 flex items-center">
          <Link href="/dashboard"><Logo /></Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">{navItems}</div>
        <div className="p-3 space-y-0.5">
          <div className="h-px bg-border mx-3 mb-2" />
          <Link
            href="/notifications"
            className={cn(
              navLink,
              isActive("/notifications") ? "bg-accent-soft text-accent font-semibold" : "text-muted hover:text-fg hover:bg-subtle",
            )}
          >
            <Bell size={17} strokeWidth={1.8} />
            Notifications
            {unread > 0 && (
              <span className="ml-auto text-[10px] font-semibold bg-accent text-accent-fg rounded-full min-w-4.5 h-4.5 px-1.5 inline-flex items-center justify-center">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
          <Link
            href="/settings"
            className={cn(
              navLink,
              isActive("/settings") ? "bg-accent-soft text-accent font-semibold" : "text-muted hover:text-fg hover:bg-subtle",
            )}
          >
            <Settings size={17} strokeWidth={1.8} />
            Settings
          </Link>
          <div className="flex items-center gap-2.5 px-3 h-12 mt-1.5 rounded-xl bg-subtle/60">
            <div className="w-8 h-8 rounded-full bg-accent text-accent-fg inline-flex items-center justify-center text-xs font-bold shrink-0 shadow-[var(--shadow-card)]">
              {(userName || userEmail).slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate">{userName || "Driver"}</p>
              <p className="text-[11px] text-faint truncate">{userEmail}</p>
            </div>
            <button onClick={logout} aria-label="Sign out" className="text-faint hover:text-negative p-1.5 rounded-lg transition-colors">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar — frosted, iOS-style */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 border-b border-border glass">
        <Link href="/dashboard"><Logo /></Link>
        <div className="flex items-center gap-0.5">
          <Link
            href="/notifications" aria-label="Notifications"
            className="relative p-2.5 rounded-full text-muted hover:text-fg hover:bg-subtle transition-colors"
          >
            <Bell size={19} strokeWidth={1.8} />
            {unread > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent ring-2 ring-[var(--glass)]" />}
          </Link>
          <button
            onClick={() => setMenuOpen((v) => !v)} aria-label="Menu" aria-expanded={menuOpen}
            className="p-2.5 rounded-full text-muted hover:text-fg hover:bg-subtle transition-colors"
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </header>

      {/* Mobile slide-down menu — frosted sheet */}
      {menuOpen && (
        <>
          <button
            aria-label="Close menu"
            className="lg:hidden fixed inset-0 top-14 z-30 bg-black/20 animate-fade-in"
            onClick={() => setMenuOpen(false)}
          />
          <div className="lg:hidden fixed inset-x-0 top-14 z-40 border-b border-border glass-strong shadow-[var(--shadow-raised)] p-3 space-y-3 animate-menu-drop rounded-b-3xl">
            {navItems}
            <div className="border-t border-border pt-3 flex items-center justify-between px-2 pb-1">
              <Link href="/settings" className="flex items-center gap-2 text-sm text-muted">
                <Settings size={16} /> Settings
              </Link>
              <button onClick={logout} className="flex items-center gap-2 text-sm text-muted">
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </div>
        </>
      )}

      {/* Content — page entrance animation replays on each navigation */}
      <main className="lg:pl-64 pb-24 lg:pb-10">
        <div key={pathname} className="mx-auto max-w-6xl px-4 sm:px-6 py-6 animate-fade-up">
          {children}
        </div>
      </main>

      {/* Mobile bottom tab bar — iOS frosted tab bar */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border glass flex justify-around"
        aria-label="Mobile"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {MOBILE_PRIMARY.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-0.5 pt-2 pb-1.5 px-3 text-[10px] font-medium min-w-16",
              "transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-90",
              isActive(item.href) ? "text-accent" : "text-muted",
            )}
          >
            <item.icon
              size={22}
              strokeWidth={isActive(item.href) ? 2.2 : 1.7}
              className="transition-transform duration-200"
            />
            {item.label}
          </Link>
        ))}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className={cn(
            "flex flex-col items-center gap-0.5 pt-2 pb-1.5 px-3 text-[10px] font-medium min-w-16",
            "transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-90",
            menuOpen ? "text-accent" : "text-muted",
          )}
        >
          <MoreHorizontal size={22} strokeWidth={1.7} />
          More
        </button>
      </nav>
    </div>
  );
}
