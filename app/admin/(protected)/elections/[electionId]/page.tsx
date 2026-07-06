import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CandidateForm } from "@/components/admin/candidate-form";
import { ElectionStatusControl } from "@/components/admin/election-status-control";

export default async function ElectionDetailPage({ params }: { params: { electionId: string } }) {
  const election = await prisma.election.findUnique({
    where: { id: params.electionId },
    include: { candidates: { orderBy: { sortOrder: "asc" } } },
  });

  if (!election) notFound();

  return (
    <div>
      <h1>{election.title}</h1>
      <p>
        Seats: {election.seats} &middot; Status: {election.status}
      </p>
      <ElectionStatusControl electionId={election.id} status={election.status} />

      <nav className="election-subnav">
        <Link href={`/admin/elections/${election.id}/codes`}>Access codes</Link>
        <Link href={`/admin/elections/${election.id}/results`}>Results</Link>
      </nav>

      <h2>Candidates</h2>
      <ul>
        {election.candidates.map((c) => (
          <li key={c.id}>
            {c.name}
            {c.party ? ` (${c.party})` : ""}
          </li>
        ))}
      </ul>
      <CandidateForm electionId={election.id} />

      <p className="voter-link-hint">
        Voter link: <code>/vote/{election.id}</code>
      </p>
    </div>
  );
}
