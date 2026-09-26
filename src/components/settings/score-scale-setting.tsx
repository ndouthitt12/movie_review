"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { scoreScales, type ScoreScale } from "@/lib/score-format";
import { loginHref, useIsOwner } from "@/lib/use-is-owner";

/**
 * The out-of-5 or out-of-10 switch on the Settings page. Pass null while the
 * saved value loads; the switch then shows with no choice selected.
 */
export function ScoreScaleSetting({
  initialScale,
}: {
  initialScale: ScoreScale | null;
}) {
  const owner = useIsOwner();
  const router = useRouter();
  const [scale, setScale] = useState(initialScale);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function choose(next: ScoreScale) {
    if (next === scale || saving) return;
    const previous = scale;
    setScale(next);
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/display", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scoreScale: next }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setScale(previous);
        setMessage(body.error ?? "Could not save. Try again.");
        return;
      }
      setMessage(`Saved. Scores now show out of ${next}.`);
      // Clears the router cache, so other pages load with the new scale.
      router.refresh();
    } catch {
      setScale(previous);
      setMessage("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-paper-100 font-semibold">Overall scores</p>
        <p className="text-paper-500 mt-0.5 text-sm">
          Show every overall score out of 5 or out of 10. Saved ratings do not
          change.
        </p>
        {message ? (
          <p className="text-accent-400 mt-1.5 text-sm" role="status">
            {message}
          </p>
        ) : !owner && scale !== null ? (
          <p className="text-paper-500 mt-1.5 text-sm">
            <Link
              href={loginHref("/settings")}
              className="text-accent-400 hover:text-accent-300"
            >
              Log in
            </Link>{" "}
            to change this.
          </p>
        ) : null}
      </div>
      <div
        role="group"
        aria-label="Overall score scale"
        className="border-hairline bg-ink-950 rounded-ui inline-flex border p-[3px]"
      >
        {scoreScales.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={scale === option}
            disabled={!owner || scale === null || saving}
            onClick={() => choose(option)}
            className={`rounded-md px-3 py-1.5 text-[0.8rem] transition-colors disabled:cursor-not-allowed ${
              scale === option
                ? "bg-ink-850 text-paper-100"
                : "text-paper-500 enabled:hover:text-paper-300"
            }`}
          >
            Out of {option}
          </button>
        ))}
      </div>
    </div>
  );
}
