import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { AdminNav } from "@/components/admin/admin-nav";
import "../admin.css";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  return (
    <div className="admin-shell">
      <AdminNav email={session.email} />
      <div className="admin-content">{children}</div>
    </div>
  );
}
