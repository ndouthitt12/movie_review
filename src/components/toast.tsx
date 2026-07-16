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
      className={`rounded-card fixed right-4 bottom-4 z-50 flex max-w-md items-start gap-4 border px-4 py-3 text-sm shadow-2xl ${
        toast.tone === "error"
          ? "border-red-500/50 bg-red-950 text-red-100"
          : "border-accent-400/50 bg-ink-850 text-paper-100"
      }`}
    >
      <span className="whitespace-pre-line">{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        className="text-paper-500 hover:text-paper-100 ml-auto"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}
