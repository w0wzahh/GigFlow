"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

const EXIT_MS = 230;

/**
 * iOS-style sheet dialog. Bottom-anchored sheet with grabber on mobile,
 * centered scale-in dialog on desktop. Enter + exit animations via CSS
 * keyframes; prefers-reduced-motion collapses them to instant.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Render-time state adjustment: keep the sheet mounted while it animates out.
  const [closing, setClosing] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    setClosing(!open);
  }

  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => setClosing(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [closing]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    // Lock body scroll while the sheet is open (iOS behavior).
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open && !closing) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        aria-label="Close"
        className={cn(
          "absolute inset-0 bg-black/40 cursor-default backdrop-blur-[2px]",
          closing ? "animate-fade-out" : "animate-fade-in",
        )}
        onClick={onClose}
      />
      <div
        ref={ref}
        className={cn(
          "relative w-full glass-strong border border-border shadow-[var(--shadow-sheet)]",
          "rounded-t-[24px] sm:rounded-2xl max-h-[92dvh] overflow-y-auto overscroll-contain",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
          closing
            ? "animate-sheet-down sm:animate-scale-out"
            : "animate-sheet-up sm:animate-scale-in",
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* iOS grabber — mobile only */}
        <div className="sm:hidden pt-2 pb-1 flex justify-center" aria-hidden="true">
          <span className="w-9 h-1 rounded-full bg-border-strong" />
        </div>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border sticky top-0 glass-strong z-10 rounded-t-[24px] sm:rounded-t-2xl">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-muted hover:text-fg bg-subtle hover:bg-border rounded-full p-1.5 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
