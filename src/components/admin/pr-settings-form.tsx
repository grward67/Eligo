"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface Props {
  electionId: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  prThreshold: number;
  prCalculationMethod: "DHONDT" | "SAINTE_LAGUE";
  prAllowBlankVote: boolean;
}

const METHOD_LABELS: Record<string, string> = {
  DHONDT: "D'Hondt",
  SAINTE_LAGUE: "Sainte-Lague",
};

export function PrSettingsForm({ electionId, status, prThreshold, prCalculationMethod, prAllowBlankVote }: Props) {
  const router = useRouter();
  const [threshold, setThreshold] = useState(String(prThreshold));
  const [method, setMethod] = useState(prCalculationMethod);
  const [allowBlankVote, setAllowBlankVote] = useState(prAllowBlankVote);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status !== "DRAFT") {
    return (
      <p className="schedule-hint">
        Electoral threshold: {prThreshold}% &middot; Calculation method: {METHOD_LABELS[prCalculationMethod]} &middot; Blank vote:{" "}
        {prAllowBlankVote ? "on" : "off"}
      </p>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsedThreshold = parseFloat(threshold);
    if (Number.isNaN(parsedThreshold) || parsedThreshold < 0 || parsedThreshold > 100) {
      setError("Threshold must be a number between 0 and 100.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/admin/elections/${electionId}/pr-settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prThreshold: parsedThreshold, prCalculationMethod: method, prAllowBlankVote: allowBlankVote }),
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
        Electoral threshold (%)
        <input type="number" min={0} max={100} step={0.1} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
      </label>
      <fieldset className="radio-fieldset">
        <legend>Calculation method</legend>
        <label className="radio-label">
          <input type="radio" name="pr-method" checked={method === "DHONDT"} onChange={() => setMethod("DHONDT")} />
          D&apos;Hondt
        </label>
        <label className="radio-label">
          <input type="radio" name="pr-method" checked={method === "SAINTE_LAGUE"} onChange={() => setMethod("SAINTE_LAGUE")} />
          Sainte-Lague
        </label>
      </fieldset>
      <fieldset className="radio-fieldset">
        <legend>Allow blank vote</legend>
        <label className="radio-label">
          <input type="radio" name="pr-blank" checked={allowBlankVote} onChange={() => setAllowBlankVote(true)} />
          On
        </label>
        <label className="radio-label">
          <input type="radio" name="pr-blank" checked={!allowBlankVote} onChange={() => setAllowBlankVote(false)} />
          Off
        </label>
      </fieldset>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}
