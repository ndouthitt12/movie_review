"use client";

import { useEffect } from "react";

/**
 * Stops the page behind a modal from scrolling while `active` is true.
 * Without it, a swipe that reaches the end of the modal's list scrolls the
 * page underneath on phones.
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [active]);
}
