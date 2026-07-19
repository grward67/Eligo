import { prisma } from "@/lib/db";
import { CreateElectionForm } from "@/components/admin/create-election-form";
import { ElectionsList } from "@/components/admin/elections-list";

export default async function AdminDashboardPage() {
  const elections = await prisma.election.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <h1>Elections</h1>
      <CreateElectionForm />
      <ElectionsList elections={elections.map((e) => ({ id: e.id, title: e.title, status: e.status }))} />
    </div>
  );
}
