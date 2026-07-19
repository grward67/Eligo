import { prisma } from "@/lib/db";
import { GenerateCodeForm } from "@/components/admin/generate-code-form";
import { RevokeCodeButton } from "@/components/admin/revoke-code-button";

export default async function CodesPage({ params }: { params: { electionId: string } }) {
  const codes = await prisma.accessCode.findMany({
    where: { electionId: params.electionId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      maxUses: true,
      useCount: true,
      active: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  // One-time codes go inactive either because a vote was cast (normal) or
  // because an admin revoked them (also possible) -- distinguish the two
  // in the table so "Revoked" doesn't misleadingly imply admin action.
  const votedSessions = await prisma.voterSession.findMany({
    where: { electionId: params.electionId, ballotSubmitted: true },
    select: { accessCodeId: true },
  });
  const votedCodeIds = new Set(votedSessions.map((v) => v.accessCodeId));

  return (
    <div>
      <h1>Access codes</h1>
      <GenerateCodeForm electionId={params.electionId} />
      <table className="codes-table">
        <thead>
          <tr>
            <th>Label</th>
            <th>Uses</th>
            <th>Active</th>
            <th>Expires</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {codes.map((c) => (
            <tr key={c.id}>
              <td>{c.label ?? "—"}</td>
              <td>
                {c.maxUses === 1
                  ? `${c.useCount} login attempt${c.useCount === 1 ? "" : "s"}`
                  : `${c.useCount}${c.maxUses !== null ? ` / ${c.maxUses}` : " (unlimited)"}`}
              </td>
              <td>{c.active ? "Active" : votedCodeIds.has(c.id) ? "Voted" : "Revoked"}</td>
              <td>{c.expiresAt ? new Date(c.expiresAt).toLocaleString() : "—"}</td>
              <td>{new Date(c.createdAt).toLocaleString()}</td>
              <td>{c.active && <RevokeCodeButton codeId={c.id} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {codes.length === 0 && <p>No codes generated yet.</p>}
    </div>
  );
}
