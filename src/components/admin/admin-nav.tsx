"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function AdminNav({ email, role }: { email: string; role: "PRODUCT_ADMIN" | "ACCOUNT_ADMIN" }) {
  const router = useRouter();
  const isProductAdmin = role === "PRODUCT_ADMIN";

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <nav className="admin-nav">
      <span className="admin-nav-brand">
        <img src="/brand/logo.png" alt="Oenach" />
        Oenach
      </span>
      <Link href="/admin">Elections</Link>
      <Link href="/admin/lookup">Look up code</Link>
      {isProductAdmin && <Link href="/admin/audit">Audit log</Link>}
      {isProductAdmin && <Link href="/admin/admins">Admins</Link>}
      <span className="admin-nav-email">{email}</span>
      <button onClick={handleLogout}>Log out</button>
    </nav>
  );
}
