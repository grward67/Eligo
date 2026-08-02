import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit/log";

export interface DeleteElectionsResult {
  deletedIds: string[];
  blocked: { id: string; title: string }[];
}

/**
 * Deletes the given elections, except any still OPEN ("running") -- those
 * are reported back in `blocked` instead, untouched, so the admin can stop
 * them first. Deletable elections have their dependent rows removed
 * explicitly in dependency order (Ballot before VoterSession, since Ballot
 * also references VoterSession directly) rather than relying solely on the
 * database's ON DELETE CASCADE.
 */
export async function deleteElections(electionIds: string[], deletedById: string): Promise<DeleteElectionsResult> {
  const elections = await prisma.election.findMany({
    where: { id: { in: electionIds } },
    select: { id: true, title: true, status: true },
  });

  const blocked = elections.filter((e) => e.status === "OPEN");
  const deletable = elections.filter((e) => e.status !== "OPEN");

  if (deletable.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const e of deletable) {
        await tx.ballot.deleteMany({ where: { electionId: e.id } });
        await tx.voterSession.deleteMany({ where: { electionId: e.id } });
        await tx.accessCode.deleteMany({ where: { electionId: e.id } });
        await tx.candidate.deleteMany({ where: { electionId: e.id } });
        await tx.election.delete({ where: { id: e.id } });
      }
    });

    for (const e of deletable) {
      await writeAuditLog({
        actorType: "admin",
        actorId: deletedById,
        action: "election.delete",
        targetType: "Election",
        targetId: e.id,
        metadata: { title: e.title, status: e.status },
      });
    }
  }

  return {
    deletedIds: deletable.map((e) => e.id),
    blocked: blocked.map((e) => ({ id: e.id, title: e.title })),
  };
}

export interface UpdateVotingSystemResult {
  ok: boolean;
  error?: "NOT_FOUND" | "NOT_DRAFT" | "HAS_BALLOTS";
}

/**
 * The ballot type can only be changed while an election is still DRAFT --
 * once it's been opened (or even if reverted back to DRAFT after ballots
 * exist), STV and FPTP ballots aren't interchangeable, so switching would
 * make existing data nonsensical for whichever counting engine ran next.
 */
export async function updateVotingSystem(
  electionId: string,
  votingSystem: "STV" | "FPTP",
  updatedById: string
): Promise<UpdateVotingSystemResult> {
  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election) {
    return { ok: false, error: "NOT_FOUND" };
  }
  if (election.status !== "DRAFT") {
    return { ok: false, error: "NOT_DRAFT" };
  }

  const existingBallots = await prisma.ballot.findMany({ where: { electionId } });
  if (existingBallots.length > 0) {
    return { ok: false, error: "HAS_BALLOTS" };
  }

  await prisma.election.update({ where: { id: electionId }, data: { votingSystem } });

  await writeAuditLog({
    actorType: "admin",
    actorId: updatedById,
    action: "election.voting_system_change",
    targetType: "Election",
    targetId: electionId,
    metadata: { votingSystem },
  });

  return { ok: true };
}
