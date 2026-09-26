import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminLogin } from "@/components/admin/admin-login";
import { PageShell } from "@/components/page-shell";
import { adminAuthConfigured } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-md py-12 sm:py-20">
        <h1 className="type-page-heading text-paper-100 tracking-[-0.02em]">
          Log in
        </h1>
        <p className="type-body text-paper-300 mt-3">
          Enter your passcode to rate films, change your library, and use the
          admin tools. Anyone can view the site without logging in.
        </p>
        <Suspense fallback={null}>
          <AdminLogin configured={adminAuthConfigured()} />
        </Suspense>
      </div>
    </PageShell>
  );
}
