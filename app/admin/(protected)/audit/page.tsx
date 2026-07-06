import { prisma } from "@/lib/db";

export default async function AuditLogPage() {
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div>
      <h1>Audit log</h1>
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
                {l.actorId ? ` (${l.actorId.slice(0, 8)})` : ""}
              </td>
              <td>{l.action}</td>
              <td>{l.targetType ? `${l.targetType}:${l.targetId?.slice(0, 8)}` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {logs.length === 0 && <p>No audit events yet.</p>}
    </div>
  );
}
