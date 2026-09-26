"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";

/** Only same-site paths, so the login cannot send you to another website. */
function safeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.startsWith("/\\") || value.startsWith("/login")) return "/";
  return value;
}

export function AdminLogin({ configured }: { configured: boolean }) {
  const params = useSearchParams();
  const returnTo = safeReturnPath(params.get("next"));
  const [passcode, setPasscode] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(
    configured ? "" : "ADMIN_PASSCODE is not configured.",
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      setSaving(false);
      setMessage(body.error ?? "Could not log in.");
      return;
    }
    // A full load, so every page picks up the new session.
    window.location.assign(returnTo);
  }

  return (
    <form onSubmit={submit} className="panel mt-8 space-y-4 p-6">
      <label htmlFor="passcode" className="text-paper-300 block text-sm">
        Passcode
      </label>
      <Input
        id="passcode"
        type="password"
        value={passcode}
        onChange={(event) => setPasscode(event.target.value)}
        autoComplete="current-password"
        disabled={!configured}
        autoFocus
        required
      />
      <Button type="submit" disabled={!configured || saving}>
        {saving ? "Logging in…" : "Log in"}
      </Button>
      {message ? (
        <p className="text-accent-300 text-sm" role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}
