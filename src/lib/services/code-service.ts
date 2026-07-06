import { prisma } from "@/lib/db";
import { generateAccessCode, hashAccessCode } from "@/lib/auth/access-code";
import { writeAuditLog } from "@/lib/audit/log";

export interface GenerateCodesOptions {
  electionId: string;
  count: number;
  /** null = reusable / unlimited uses, 1 = one-time, N = capped at N uses. */
  maxUses: number | null;
  expiresAt?: Date | null;
  label?: string | null;
  createdById: string;
}

export interface GeneratedCode {
  id: string;
  plaintextCode: string;
}

export async function generateCodes(opts: GenerateCodesOptions): Promise<GeneratedCode[]> {
  if (!Number.isInteger(opts.count) || opts.count < 1 || opts.count > 500) {
    throw new Error("count must be an integer between 1 and 500");
  }

  const drafts = Array.from({ length: opts.count }, () => {
    const plaintextCode = generateAccessCode();
    return { plaintextCode, codeHash: hashAccessCode(plaintextCode) };
  });

  const created = await prisma.$transaction(
    drafts.map((d) =>
      prisma.accessCode.create({
        data: {
          electionId: opts.electionId,
          codeHash: d.codeHash,
          label: opts.label ?? null,
          maxUses: opts.maxUses,
          expiresAt: opts.expiresAt ?? null,
          createdById: opts.createdById,
        },
      })
    )
  );

  await writeAuditLog({
    actorType: "admin",
    actorId: opts.createdById,
    action: "code.create",
    targetType: "Election",
    targetId: opts.electionId,
    metadata: { count: opts.count, maxUses: opts.maxUses, label: opts.label ?? null },
  });

  return created.map((row, i) => ({ id: row.id, plaintextCode: drafts[i].plaintextCode }));
}

export async function revokeCode(codeId: string, revokedById: string): Promise<void> {
  const code = await prisma.accessCode.update({
    where: { id: codeId },
    data: { active: false },
  });

  await writeAuditLog({
    actorType: "admin",
    actorId: revokedById,
    action: "code.revoke",
    targetType: "AccessCode",
    targetId: code.id,
  });
}
