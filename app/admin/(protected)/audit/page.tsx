import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function AuditLogPage({ searchParams }: { searchParams: { target?: string; actor?: string } }) {
  const target = searchParams.target?.trim() || null;
  const actor = searchParams.actor?.trim() || null;

  const logs = await prisma.auditLog.findMany({
    where: target
      ? { OR: [{ targetId: target }, { actorId: target }] }
      : actor
        ? { actorId: actor }
        : undefined,
    orderBy: { createdAt: "desc" },
    take: target || actor ? 500 : 200,
  });

  return (
    <div>
      <h1>Audit log</h1>

      <form className="inline-form" action="/admin/audit">
        <label>
          Filter by exact id (actor or target)
          <input name="target" defaultValue={target ?? ""} placeholder="e.g. an AccessCode or VoterSession id" />
        </label>
        <button type="submit">Filter</button>
        {(target || actor) && <Link href="/admin/audit">Clear</Link>}
      </form>

      {(target || actor) && (
        <p>
          Showing up to 500 events matching <code>{target ?? actor}</code>.
        </p>
      )}
      {!target && !actor && <p>Showing the most recent 200 events across all elections.</p>}

      <table className="audit-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Target</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td>{new Date(l.createdAt).toLocaleString()}</td>
              <td>
                {l.actorType}
                {l.actorId ? ` (${l.actorId})` : ""}
              </td>
              <td>{l.action}</td>
              <td>{l.targetType ? `${l.targetType}:${l.targetId}` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {logs.length === 0 && <p>No matching audit events.</p>}
    </div>
  );
}
