import { prisma } from "@/lib/db";
import { generateAccessCode, hashAccessCode } from "@/lib/auth/access-code";
import { writeAuditLog } from "@/lib/audit/log";
import { MAX_GENERATE_COUNT } from "@/lib/services/code-limits";

export { MAX_GENERATE_COUNT } from "@/lib/services/code-limits";

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
  plaintextCode: string;
}

export async function generateCodes(opts: GenerateCodesOptions): Promise<GeneratedCode[]> {
  if (!Number.isInteger(opts.count) || opts.count < 1 || opts.count > MAX_GENERATE_COUNT) {
    throw new Error(`count must be an integer between 1 and ${MAX_GENERATE_COUNT}`);
  }

  const drafts = Array.from({ length: opts.count }, () => {
    const plaintextCode = generateAccessCode();
    return { plaintextCode, codeHash: hashAccessCode(plaintextCode) };
  });

  // A single bulk insert rather than one create() per code inside an
  // interactive transaction: for large batches (hundreds+), issuing that
  // many sequential round trips risked running past the serverless
  // function's execution time limit.
  await prisma.accessCode.createMany({
    data: drafts.map((d) => ({
      electionId: opts.electionId,
      codeHash: d.codeHash,
      label: opts.label ?? null,
      maxUses: opts.maxUses,
      expiresAt: opts.expiresAt ?? null,
      createdById: opts.createdById,
    })),
  });

  await writeAuditLog({
    actorType: "admin",
    actorId: opts.createdById,
    action: "code.create",
    targetType: "Election",
    targetId: opts.electionId,
    metadata: { count: opts.count, maxUses: opts.maxUses, label: opts.label ?? null },
  });

  return drafts.map((d) => ({ plaintextCode: d.plaintextCode }));
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
