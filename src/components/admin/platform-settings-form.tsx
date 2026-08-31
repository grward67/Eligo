"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function PlatformSettingsForm({ ballotQuotaLimit, ballotQuotaPeriodDays }: { ballotQuotaLimit: number; ballotQuotaPeriodDays: number }) {
  const router = useRouter();
  const [limit, setLimit] = useState(String(ballotQuotaLimit));
  const [periodDays, setPeriodDays] = useState(String(ballotQuotaPeriodDays));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/platform-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ballotQuotaLimit: parseInt(limit, 10), ballotQuotaPeriodDays: parseInt(periodDays, 10) }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not update settings.");
      return;
    }

    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="inline-form">
      <label>
        Ballots per account admin
        <input type="number" min={1} value={limit} onChange={(e) => setLimit(e.target.value)} />
      </label>
      <label>
        Per how many days
        <input type="number" min={1} value={periodDays} onChange={(e) => setPeriodDays(e.target.value)} />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
