"use client";

import { useState } from "react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";

export function AdminLogin({ configured }: { configured: boolean }) {
  const [passcode, setPasscode] = useState("");
  const [message, setMessage] = useState(
    configured ? "" : "ADMIN_PASSCODE is not configured.",
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) return setMessage(body.error ?? "Could not sign in.");
    window.location.assign("/admin/form");
  }

  return (
    <form onSubmit={submit} className="panel mt-8 space-y-4 p-6">
      <Input
        type="password"
        value={passcode}
        onChange={(event) => setPasscode(event.target.value)}
        placeholder="Passcode"
        autoComplete="current-password"
        disabled={!configured}
        required
      />
      <Button type="submit" disabled={!configured}>
        Enter admin
      </Button>
      {message ? (
        <p className="text-accent-400 text-sm" role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}
