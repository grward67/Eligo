import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { updatePlatformSettings } from "@/lib/services/platform-settings-service";

const bodySchema = z.object({
  ballotQuotaLimit: z.number().int().min(1),
  ballotQuotaPeriodDays: z.number().int().min(1),
});

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_LIMIT: "Ballot limit must be a positive whole number.",
  INVALID_PERIOD: "The time period must be a positive whole number of days.",
};

export async function POST(request: NextRequest) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (admin.role !== "PRODUCT_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = await updatePlatformSettings(parsed.data, admin.sub);

  if (!result.ok) {
    return NextResponse.json({ error: ERROR_MESSAGES[result.error ?? ""] ?? "Could not update settings." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
