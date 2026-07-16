import Link from "next/link";
import { redirect } from "next/navigation";
import { TabBar, type TabItem } from "@/components/ui/tab-bar";
import { Wordmark } from "@/components/ui/wordmark";
import { isAdminAuthenticated } from "@/lib/admin-auth";

const tabs: TabItem[] = [
  { label: "Overview", href: "/admin", exact: true },
  { label: "Form", href: "/admin/form" },
  { label: "Scoring", href: "/admin/scoring" },
  { label: "Scale", href: "/admin/scale" },
  { label: "RCA", href: "/admin/rca" },
  { label: "Versions", href: "/admin/versions" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAdminAuthenticated())) redirect("/admin-login");

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1500px] px-4 py-7 sm:px-6 sm:py-9 lg:px-10">
      <header>
        <Link href="/" aria-label="Picture House home">
          <Wordmark className="text-3xl sm:text-4xl" />
        </Link>
        <h1 className="type-page-heading text-paper-100 mt-7 tracking-[-0.03em]">
          Admin
        </h1>
        <TabBar tabs={tabs} className="mt-7" />
      </header>
      <main className="py-6 sm:py-8">{children}</main>
    </div>
  );
}
