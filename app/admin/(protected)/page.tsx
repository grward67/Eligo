import Link from "next/link";
import { prisma } from "@/lib/db";
import { CreateElectionForm } from "@/components/admin/create-election-form";

export default async function AdminDashboardPage() {
  const elections = await prisma.election.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <h1>Elections</h1>
      <CreateElectionForm />
      <ul className="election-list">
        {elections.map((e) => (
          <li key={e.id}>
            <Link href={`/admin/elections/${e.id}`}>{e.title}</Link>
            <span className={`status-badge status-${e.status.toLowerCase()}`}>{e.status}</span>
          </li>
        ))}
      </ul>
      {elections.length === 0 && <p>No elections yet. Create one above.</p>}
    </div>
  );
}
