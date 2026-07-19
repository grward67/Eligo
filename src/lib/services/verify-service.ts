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
  error: "ELECTION_NOT_OPEN" | "INVALID_CODE" | "ALREADY_VOTED";
}

export type VerifyCodeResult = VerifyCodeSuccess | VerifyCodeFailure;

const VOTER_SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2h, matches voter-session.ts JWT expiry

/**
 * The single authoritative check for "is this code allowed to unlock the
 * ballot right now". Election must be open and the code must hash-match.
 *
 * One-time codes (maxUses === 1) allow unlimited login attempts and are
 * only blocked once a ballot has actually been submitted through them
 * (checked directly against VoterSession.ballotSubmitted, not just the
 * `active` flag, so a code an admin manually revoked doesn't get
 * misreported as "already voted"). Reusable/capped codes (maxUses null
 * or > 1) keep the original use-count based gating so a shared code can
 * still be verified by multiple different voters.
 */
export async function verifyAccessCode(electionId: string, rawCode: string): Promise<VerifyCodeResult> {
  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election || election.status !== "OPEN") {
    return { ok: false, error: "ELECTION_NOT_OPEN" };
  }

  const codeHash = hashAccessCode(rawCode);
  const now = new Date();

  const accessCode = await prisma.accessCode.findFirst({
    where: { electionId, codeHash },
  });

  if (!accessCode) {
    await logVerifyFailure(electionId);
    return { ok: false, error: "INVALID_CODE" };
  }

  const expired = accessCode.expiresAt !== null && accessCode.expiresAt <= now;
  const isOneTime = accessCode.maxUses === 1;

  if (isOneTime) {
    if (!accessCode.active || expired) {
      const votedSession = await prisma.voterSession.findFirst({
        where: { accessCodeId: accessCode.id, ballotSubmitted: true },
      });
      if (votedSession) {
        await writeAuditLog({
          actorType: "voter",
          action: "code.verify_already_voted",
          targetType: "AccessCode",
          targetId: accessCode.id,
          metadata: { electionId },
        });
        return { ok: false, error: "ALREADY_VOTED" };
      }
      await logVerifyFailure(electionId);
      return { ok: false, error: "INVALID_CODE" };
    }
    // active, not expired, and no ballot submitted yet: allow unlimited logins.
  } else {
    const exhausted = accessCode.maxUses !== null && accessCode.useCount >= accessCode.maxUses;
    if (!accessCode.active || expired || exhausted) {
      await logVerifyFailure(electionId);
      return { ok: false, error: "INVALID_CODE" };
    }
  }

  const voterSession = await prisma.$transaction(async (tx) => {
    const newUseCount = accessCode.useCount + 1;
    // Only auto-deactivate on use-count for reusable/capped codes; one-time
    // codes are deactivated separately, at the moment a ballot is submitted.
    const willExhaust = !isOneTime && accessCode.maxUses !== null && newUseCount >= accessCode.maxUses;

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

async function logVerifyFailure(electionId: string): Promise<void> {
  await writeAuditLog({
    actorType: "voter",
    action: "code.verify_failed",
    targetType: "Election",
    targetId: electionId,
  });
}
