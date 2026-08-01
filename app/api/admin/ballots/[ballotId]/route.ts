import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { deleteBallot } from "@/lib/services/ballot-service";

export async function DELETE(request: NextRequest, { params }: { params: { ballotId: string } }) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await deleteBallot(params.ballotId, admin.sub);
  if (!result.ok) {
    return NextResponse.json({ error: "Ballot not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
