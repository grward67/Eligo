import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { registerAdmin, RegisterAdminValidationError } from "@/lib/services/admin-account-service";
import { signAdminSession, ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE_SECONDS } from "@/lib/auth/admin-session";
import { writeAuditLog } from "@/lib/audit/log";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { email, password } = parsed.data;

  let result;
  try {
    result = await registerAdmin(email, password);
  } catch (err) {
    const message = err instanceof RegisterAdminValidationError ? err.message : "Could not create your account.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!result.ok || !result.admin) {
    return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
  }

  const admin = await prisma.admin.findUnique({ where: { id: result.admin.id } });
  if (!admin) {
    return NextResponse.json({ error: "Could not create your account." }, { status: 500 });
  }

  const token = await signAdminSession({ sub: admin.id, email: admin.email, role: admin.role as "PRODUCT_ADMIN" | "ACCOUNT_ADMIN" });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });

  await writeAuditLog({
    actorType: "admin",
    actorId: admin.id,
    action: "admin.login",
    metadata: { via: "register" },
  });

  return response;
}
