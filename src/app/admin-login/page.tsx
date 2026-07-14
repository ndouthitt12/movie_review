import type { Metadata } from "next";
import { AdminLogin } from "@/components/admin/admin-login";
import { PageShell } from "@/components/page-shell";
import { adminAuthConfigured } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Admin access" };

export default function AdminLoginPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-md py-20">
        <p className="eyebrow">Restricted area</p>
        <h1 className="text-paper-100 mt-2 font-serif text-5xl">
          Admin access
        </h1>
        <p className="text-paper-300 mt-4 text-sm leading-6">
          Enter the passcode configured in ADMIN_PASSCODE.
        </p>
        <AdminLogin configured={adminAuthConfigured()} />
      </div>
    </PageShell>
  );
}
