import { Suspense } from "react";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import "../admin.css";

export default function AdminLoginPage() {
  return (
    <main className="login-page">
      <Suspense fallback={null}>
        <AdminLoginForm />
      </Suspense>
    </main>
  );
}
