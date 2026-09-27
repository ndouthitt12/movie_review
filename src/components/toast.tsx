"use client";

import { useEffect } from "react";

export type ToastMessage = {
  id: number;
  message: string;
  tone?: "success" | "error";
};

export function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastMessage | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!toast || toast.tone === "error") return;
    const timer = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timer);
  }, [onDismiss, toast]);

  if (!toast) return null;
  return (
    <div
      role="status"
      // On phones the toast spans the width and clears the home bar.
      className={`rounded-card fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 z-50 flex max-w-md items-start gap-4 border px-4 py-3 text-sm shadow-2xl sm:left-auto ${
        toast.tone === "error"
          ? "border-red-500/50 bg-red-950 text-red-100"
          : "border-accent-400/50 bg-ink-850 text-paper-100"
      }`}
    >
      <span className="whitespace-pre-line">{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        className="text-paper-500 hover:text-paper-100 -my-3 -mr-3 ml-auto grid h-11 w-11 shrink-0 place-items-center text-lg"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}
