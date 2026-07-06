import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/auth/admin-session";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { writeAuditLog } from "@/lib/audit/log";

export async function POST() {
  const admin = await requireAdminSession();

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", { path: "/", maxAge: 0 });

  if (admin) {
    await writeAuditLog({ actorType: "admin", actorId: admin.sub, action: "admin.logout" });
  }

  return response;
}
