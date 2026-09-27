"use client";

import { useState, type ReactNode } from "react";

/**
 * Shows the <title> text of the chart mark the user taps, below the chart.
 * Browsers show <title> as a tooltip on hover, which a phone cannot do.
 */
export function ChartReadout({ children }: { children: ReactNode }) {
  const [readout, setReadout] = useState("");
  return (
    <div
      onClick={(event) => {
        const mark = (event.target as Element).closest("rect, circle");
        const title = mark?.querySelector(":scope > title")?.textContent;
        setReadout(title ?? "");
      }}
    >
      {children}
      {readout ? (
        <p
          className="text-paper-300 mt-2 text-xs tabular-nums"
          aria-live="polite"
        >
          {readout}
        </p>
      ) : null}
    </div>
  );
}
