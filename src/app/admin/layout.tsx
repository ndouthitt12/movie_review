import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";

const links = [
  ["Form Builder", "/admin/form"],
  ["Scoring", "/admin/scoring"],
  ["Rating Scale", "/admin/scale"],
  ["RCA Tags", "/admin/rca"],
  ["Versions", "/admin/versions"],
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAdminAuthenticated())) redirect("/admin-login");
  return (
    <div className="mx-auto grid min-h-[70vh] max-w-[1500px] gap-8 px-5 py-10 lg:grid-cols-[13rem_1fr]">
      <aside className="border-hairline border-r pr-6">
        <p className="eyebrow">Administration</p>
        <nav className="mt-5 space-y-1" aria-label="Admin navigation">
          {links.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="text-paper-300 hover:bg-ink-850 hover:text-paper-100 block px-3 py-2 text-sm"
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main>{children}</main>
    </div>
  );
}
