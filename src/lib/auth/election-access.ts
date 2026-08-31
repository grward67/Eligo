import { prisma } from "@/lib/db";
import type { AdminSessionPayload } from "@/lib/auth/admin-session";

/**
 * Central "is this admin allowed to touch this election" check, used by
 * every admin-side page and API route that operates on a specific election
 * (or something hanging off one). Product admins bypass ownership entirely;
 * account admins only ever get back elections they created.
 *
 * Returns null for BOTH "doesn't exist" and "exists but isn't yours" --
 * deliberately indistinguishable, so a crafted URL can't be used to probe
 * which election ids belong to other admins.
 */
export async function getOwnedElection(electionId: string, session: AdminSessionPayload) {
  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election) return null;
  if (session.role !== "PRODUCT_ADMIN" && election.createdById !== session.sub) return null;
  return election;
}

export function isOwnedElection(electionCreatedById: string, session: AdminSessionPayload): boolean {
  return session.role === "PRODUCT_ADMIN" || electionCreatedById === session.sub;
}

/** Same idea, for a PartyList reached by id (e.g. adding a candidate to it) -- resolves up to its election first. */
export async function getOwnedPartyList(listId: string, session: AdminSessionPayload) {
  const list = await prisma.partyList.findUnique({ where: { id: listId } });
  if (!list) return null;
  const election = await getOwnedElection(list.electionId, session);
  if (!election) return null;
  return list;
}

/** Same idea, for an AccessCode reached by id (e.g. revoking it). */
export async function getOwnedAccessCode(codeId: string, session: AdminSessionPayload) {
  const code = await prisma.accessCode.findUnique({ where: { id: codeId } });
  if (!code) return null;
  const election = await getOwnedElection(code.electionId, session);
  if (!election) return null;
  return code;
}

/** Same idea, for a Ballot reached by id (e.g. deleting it). */
export async function getOwnedBallot(ballotId: string, session: AdminSessionPayload) {
  const ballot = await prisma.ballot.findUnique({ where: { id: ballotId } });
  if (!ballot) return null;
  const election = await getOwnedElection(ballot.electionId, session);
  if (!election) return null;
  return ballot;
}
