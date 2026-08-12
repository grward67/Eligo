"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { zonedTimeToUtc, getWallClockParts, listTimeZones, formatInTimeZone } from "@/lib/timezone";

interface Props {
  electionId: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  scheduleTimezone: string | null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateInputValue(parts: { year: number; month: number; day: number }): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function toTimeInputValue(parts: { hour: number; minute: number }): string {
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
}

function splitDateTime(iso: string | null, timeZone: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const parts = getWallClockParts(new Date(iso), timeZone);
  return { date: toDateInputValue(parts), time: toTimeInputValue(parts) };
}

function toUtcIso(date: string, time: string, timeZone: string): string | null {
  if (!date || !time) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return zonedTimeToUtc(year, month, day, hour, minute, timeZone).toISOString();
}

export function ElectionScheduleForm({ electionId, status, scheduledStartAt, scheduledEndAt, scheduleTimezone }: Props) {
  const router = useRouter();
  const [timezone, setTimezone] = useState(
    scheduleTimezone ?? (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC")
  );
  const initialStart = splitDateTime(scheduledStartAt, timezone);
  const initialEnd = splitDateTime(scheduledEndAt, timezone);
  const [startDate, setStartDate] = useState(initialStart.date);
  const [startTime, setStartTime] = useState(initialStart.time);
  const [endDate, setEndDate] = useState(initialEnd.date);
  const [endTime, setEndTime] = useState(initialEnd.time);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "CLOSED") return null;

  const timezones = listTimeZones();

  async function submit(body: { scheduledStartAt?: string | null; scheduledEndAt: string | null; scheduleTimezone: string | null }) {
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/admin/elections/${electionId}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not update the schedule.");
      return;
    }

    router.refresh();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const endIso = toUtcIso(endDate, endTime, timezone);
    if ((endDate || endTime) && !endIso) {
      setError("Enter both an end date and an end time, or leave both blank.");
      return;
    }

    if (status === "DRAFT") {
      const startIso = toUtcIso(startDate, startTime, timezone);
      if ((startDate || startTime) && !startIso) {
        setError("Enter both a start date and a start time, or leave both blank.");
        return;
      }
      await submit({ scheduledStartAt: startIso, scheduledEndAt: endIso, scheduleTimezone: endIso || startIso ? timezone : null });
    } else {
      await submit({ scheduledEndAt: endIso, scheduleTimezone: endIso ? timezone : null });
    }
  }

  async function handleClear() {
    setStartDate("");
    setStartTime("");
    setEndDate("");
    setEndTime("");
    await submit(status === "DRAFT" ? { scheduledStartAt: null, scheduledEndAt: null, scheduleTimezone: null } : { scheduledEndAt: null, scheduleTimezone: null });
  }

  const hasSchedule = Boolean(scheduledStartAt || scheduledEndAt);

  return (
    <form onSubmit={handleSubmit} className="inline-form schedule-form">
      {status === "DRAFT" ? (
        <label>
          Start date
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
      ) : (
        <p className="schedule-hint">Voting already started manually or automatically -- only the end can be scheduled now.</p>
      )}
      {status === "DRAFT" && (
        <label>
          Start time
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </label>
      )}
      <label>
        End date
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </label>
      <label>
        End time
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
      </label>
      <label>
        Timezone
        <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={submitting}>
        {submitting ? "Saving..." : "Save schedule"}
      </button>
      {hasSchedule && (
        <button type="button" onClick={handleClear} disabled={submitting} className="schedule-clear-btn">
          Clear schedule
        </button>
      )}
      {error && <p className="form-error">{error}</p>}
      {scheduledStartAt && (
        <p className="schedule-hint">Scheduled start: {formatInTimeZone(new Date(scheduledStartAt), scheduleTimezone ?? timezone)}</p>
      )}
      {scheduledEndAt && (
        <p className="schedule-hint">Scheduled end: {formatInTimeZone(new Date(scheduledEndAt), scheduleTimezone ?? timezone)}</p>
      )}
    </form>
  );
}
