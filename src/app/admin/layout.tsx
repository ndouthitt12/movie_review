import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { RouteContentLoading } from "@/components/route-content-loading";
import { TabBar, type TabItem } from "@/components/ui/tab-bar";
import { Wordmark } from "@/components/ui/wordmark";
import { isAdminAuthenticated } from "@/lib/admin-auth";

const tabs: TabItem[] = [
  { label: "Overview", href: "/admin", exact: true },
  { label: "Form", href: "/admin/form" },
  { label: "Scoring", href: "/admin/scoring" },
  { label: "Scale", href: "/admin/scale" },
  { label: "Why tags", href: "/admin/rca" },
  { label: "Versions", href: "/admin/versions" },
];

export const unstable_instant = false;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<RouteContentLoading label="Checking admin access" />}>
      <AuthenticatedAdminLayout>{children}</AuthenticatedAdminLayout>
    </Suspense>
  );
}

async function AuthenticatedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAdminAuthenticated())) redirect("/admin-login");

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1500px] px-4 py-7 sm:px-6 sm:py-9 lg:px-10">
      <header>
        <div className="flex items-center justify-between gap-4">
          <Link href="/" aria-label="Reeler rankings">
            <Wordmark />
          </Link>
          <Link
            href="/settings"
            className="text-paper-500 hover:text-paper-100 text-sm transition-colors"
          >
            ← Back to Settings
          </Link>
        </div>
        <h1 className="type-page-heading text-paper-100 mt-7 tracking-[-0.03em]">
          Admin
        </h1>
        <TabBar tabs={tabs} className="mt-7" />
      </header>
      <main className="py-6 sm:py-8">{children}</main>
    </div>
  );
}
