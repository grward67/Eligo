"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function AdminNav({ email }: { email: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <nav className="admin-nav">
      <span className="admin-nav-brand">
        <img src="/brand/logo.png" alt="Eligo" />
        Eligo
      </span>
      <Link href="/admin">Elections</Link>
      <Link href="/admin/audit">Audit log</Link>
      <span className="admin-nav-email">{email}</span>
      <button onClick={handleLogout}>Log out</button>
    </nav>
  );
}
