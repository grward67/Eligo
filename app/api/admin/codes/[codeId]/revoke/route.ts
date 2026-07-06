import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { revokeCode } from "@/lib/services/code-service";

export async function POST(request: NextRequest, { params }: { params: { codeId: string } }) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await revokeCode(params.codeId, admin.sub);
  return NextResponse.json({ ok: true });
}
