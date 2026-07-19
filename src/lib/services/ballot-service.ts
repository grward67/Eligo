import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit/log";

export interface SubmitBallotSuccess {
  ok: true;
  ballotId: string;
}

export interface SubmitBallotFailure {
  ok: false;
  error: "SESSION_NOT_FOUND" | "SESSION_EXPIRED" | "ALREADY_SUBMITTED" | "ELECTION_NOT_OPEN" | "INVALID_RANKING";
}

export type SubmitBallotResult = SubmitBallotSuccess | SubmitBallotFailure;

/** Used by the ballot page to decide whether to show the form, a "you already voted" message, or bounce back to code entry. */
export async function getActiveVoterSession(voterSessionId: string, electionId: string) {
  const session = await prisma.voterSession.findUnique({ where: { id: voterSessionId } });
  if (!session || session.electionId !== electionId || session.revoked) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  return session;
}

export async function submitBallot(
  voterSessionId: string,
  electionId: string,
  ranking: string[]
): Promise<SubmitBallotResult> {
  const session = await prisma.voterSession.findUnique({ where: { id: voterSessionId } });

  if (!session || session.electionId !== electionId || session.revoked) {
    return { ok: false, error: "SESSION_NOT_FOUND" };
  }
  if (session.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "SESSION_EXPIRED" };
  }
  if (session.ballotSubmitted) {
    return { ok: false, error: "ALREADY_SUBMITTED" };
  }

  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election || election.status !== "OPEN") {
    return { ok: false, error: "ELECTION_NOT_OPEN" };
  }

  const candidates = await prisma.candidate.findMany({ where: { electionId } });
  const candidateIds = new Set(candidates.map((c) => c.id));
  const uniqueRanking = new Set(ranking);

  const rankingValid =
    ranking.length > 0 && ranking.length === uniqueRanking.size && ranking.every((id) => candidateIds.has(id));

  if (!rankingValid) {
    return { ok: false, error: "INVALID_RANKING" };
  }

  const ballot = await prisma.$transaction(async (tx) => {
    const created = await tx.ballot.create({
      data: {
        electionId,
        voterSessionId,
        ranking: JSON.stringify(ranking),
      },
    });
    await tx.voterSession.update({
      where: { id: voterSessionId },
      data: { ballotSubmitted: true },
    });

    // One-time codes are only blocked once a vote is actually cast (not on
    // login) -- this is where that block takes effect. Reusable/capped
    // codes are untouched here; they stay governed by verify-service's
    // use-count logic so other voters can still use the same code.
    const accessCode = await tx.accessCode.findUnique({ where: { id: session.accessCodeId } });
    if (accessCode && accessCode.maxUses === 1) {
      await tx.accessCode.update({ where: { id: accessCode.id }, data: { active: false } });
    }

    return created;
  });

  await writeAuditLog({
    actorType: "voter",
    actorId: voterSessionId,
    action: "ballot.submit",
    targetType: "Ballot",
    targetId: ballot.id,
    metadata: { electionId },
  });

  return { ok: true, ballotId: ballot.id };
}
