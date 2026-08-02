import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { buildElectionCountLog } from "@/lib/services/election-count-log-service";

export async function GET(request: NextRequest, { params }: { params: { electionId: string } }) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await buildElectionCountLog(params.electionId);

  if (!result.ok) {
    const status = result.error === "NOT_FOUND" ? 404 : 400;
    const message =
      result.error === "NOT_FOUND"
        ? "Election not found."
        : result.error === "NO_BALLOTS"
          ? "No ballots have been submitted yet."
          : (result.message ?? "Could not compute results.");
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json(result.log);
}
