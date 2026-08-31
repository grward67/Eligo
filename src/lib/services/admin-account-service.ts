import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { writeAuditLog } from "@/lib/audit/log";

export interface RegisterAdminResult {
  ok: boolean;
  error?: "EMAIL_TAKEN";
  admin?: { id: string; email: string };
}

const MIN_PASSWORD_LENGTH = 8;

export class RegisterAdminValidationError extends Error {}

/** Public self-service signup: always creates an ACCOUNT_ADMIN (the schema default) -- there is no way to register as a product admin. */
export async function registerAdmin(email: string, password: string): Promise<RegisterAdminResult> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new RegisterAdminValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "EMAIL_TAKEN" };
  }

  const passwordHash = await hashPassword(password);
  const admin = await prisma.admin.create({ data: { email, passwordHash } });

  await writeAuditLog({
    actorType: "admin",
    actorId: admin.id,
    action: "admin.register",
    targetType: "Admin",
    targetId: admin.id,
    metadata: { email },
  });

  return { ok: true, admin: { id: admin.id, email: admin.email } };
}
