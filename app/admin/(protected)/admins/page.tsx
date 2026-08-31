import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { getPlatformSettings } from "@/lib/services/platform-settings-service";
import { getBallotQuotaStatus } from "@/lib/services/quota-service";
import { PlatformSettingsForm } from "@/components/admin/platform-settings-form";

export default async function AdminsPage() {
  const session = await requireAdminSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "PRODUCT_ADMIN") redirect("/admin");

  const [admins, settings] = await Promise.all([prisma.admin.findMany({ orderBy: { createdAt: "asc" } }), getPlatformSettings()]);

  const rows = await Promise.all(
    admins.map(async (a) => ({
      ...a,
      quota: a.role === "ACCOUNT_ADMIN" ? await getBallotQuotaStatus(a.id) : null,
    }))
  );

  return (
    <div>
      <h1>Admins</h1>

      <h2>Ballot quota policy</h2>
      <p>Applies to every account admin.</p>
      <PlatformSettingsForm ballotQuotaLimit={settings.ballotQuotaLimit} ballotQuotaPeriodDays={settings.ballotQuotaPeriodDays} />

      <h2>Registered admins</h2>
      <table className="codes-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Ballots used</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td>{a.email}</td>
              <td>{a.role === "PRODUCT_ADMIN" ? "Product admin" : "Account admin"}</td>
              <td>{a.quota ? `${a.quota.used} / ${a.quota.limit} (last ${a.quota.periodDays}d)` : "—"}</td>
              <td>{new Date(a.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
