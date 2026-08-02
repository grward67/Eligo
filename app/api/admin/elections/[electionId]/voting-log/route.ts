import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { buildVotingLog } from "@/lib/services/voting-log-service";

export async function GET(request: NextRequest, { params }: { params: { electionId: string } }) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = await buildVotingLog(params.electionId);
  if (!log) {
    return NextResponse.json({ error: "Election not found." }, { status: 404 });
  }

  return NextResponse.json(log);
}
