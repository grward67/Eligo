import { prisma } from "@/lib/db";
import { hashAccessCode } from "@/lib/auth/access-code";
import { writeAuditLog } from "@/lib/audit/log";

export interface VerifyCodeSuccess {
  ok: true;
  voterSessionId: string;
  electionId: string;
}

export interface VerifyCodeFailure {
  ok: false;
  error: "ELECTION_NOT_OPEN" | "INVALID_CODE";
}

export type VerifyCodeResult = VerifyCodeSuccess | VerifyCodeFailure;

const VOTER_SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2h, matches voter-session.ts JWT expiry

/**
 * The single authoritative check for "is this code allowed to unlock the
 * ballot right now". Everything the voter flow depends on funnels through
 * here: election must be open, code must hash-match, be active,
 * unexpired, and have uses remaining.
 */
export async function verifyAccessCode(electionId: string, rawCode: string): Promise<VerifyCodeResult> {
  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election || election.status !== "OPEN") {
    return { ok: false, error: "ELECTION_NOT_OPEN" };
  }

  const codeHash = hashAccessCode(rawCode);
  const now = new Date();

  const accessCode = await prisma.accessCode.findFirst({
    where: {
      electionId,
      codeHash,
      active: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });

  if (!accessCode || (accessCode.maxUses !== null && accessCode.useCount >= accessCode.maxUses)) {
    await writeAuditLog({
      actorType: "voter",
      action: "code.verify_failed",
      targetType: "Election",
      targetId: electionId,
    });
    return { ok: false, error: "INVALID_CODE" };
  }

  const voterSession = await prisma.$transaction(async (tx) => {
    const newUseCount = accessCode.useCount + 1;
    const willExhaust = accessCode.maxUses !== null && newUseCount >= accessCode.maxUses;

    await tx.accessCode.update({
      where: { id: accessCode.id },
      data: {
        useCount: newUseCount,
        active: willExhaust ? false : accessCode.active,
      },
    });

    return tx.voterSession.create({
      data: {
        accessCodeId: accessCode.id,
        electionId,
        expiresAt: new Date(Date.now() + VOTER_SESSION_TTL_MS),
      },
    });
  });

  await writeAuditLog({
    actorType: "voter",
    actorId: voterSession.id,
    action: "code.use",
    targetType: "AccessCode",
    targetId: accessCode.id,
    metadata: { electionId },
  });

  return { ok: true, voterSessionId: voterSession.id, electionId };
}
