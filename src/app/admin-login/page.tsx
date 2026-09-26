import { redirect } from "next/navigation";

// The old admin login address. The site-wide login page replaced it.
export default function AdminLoginPage() {
  redirect("/login?next=/admin");
}
