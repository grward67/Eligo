import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { updateSchedule } from "@/lib/services/election-schedule-service";

const bodySchema = z.object({
  scheduledStartAt: z.string().datetime().nullable().optional(),
  scheduledEndAt: z.string().datetime().nullable(),
  scheduleTimezone: z.string().nullable(),
});

const ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND: "Election not found.",
  CLOSED: "The schedule can't be changed once an election has closed.",
  START_NOT_ALLOWED: "The start time can only be set before an election has opened.",
  END_IN_PAST: "The end date and time must be in the future.",
  INVALID_RANGE: "The end date and time must be after the start date and time.",
  TIMEZONE_REQUIRED: "Choose a timezone for the date(s) you're setting.",
  INVALID_TIMEZONE: "That timezone isn't recognized.",
};

export async function POST(request: NextRequest, { params }: { params: { electionId: string } }) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = await updateSchedule(
    params.electionId,
    {
      scheduledStartAt:
        parsed.data.scheduledStartAt === undefined ? undefined : parsed.data.scheduledStartAt === null ? null : new Date(parsed.data.scheduledStartAt),
      scheduledEndAt: parsed.data.scheduledEndAt === null ? null : new Date(parsed.data.scheduledEndAt),
      scheduleTimezone: parsed.data.scheduleTimezone,
    },
    admin.sub
  );

  if (!result.ok) {
    const status =
      result.error === "NOT_FOUND"
        ? 404
        : result.error === "CLOSED" || result.error === "START_NOT_ALLOWED"
          ? 409
          : 400;
    return NextResponse.json({ error: ERROR_MESSAGES[result.error ?? ""] ?? "Could not update the schedule." }, { status });
  }

  return NextResponse.json({ ok: true });
}
