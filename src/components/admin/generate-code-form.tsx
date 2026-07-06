"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function GenerateCodeForm({ electionId }: { electionId: string }) {
  const router = useRouter();
  const [count, setCount] = useState(1);
  const [reusable, setReusable] = useState(false);
  const [maxUses, setMaxUses] = useState(1);
  const [label, setLabel] = useState("");
  const [generated, setGenerated] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setGenerated(null);

    const res = await fetch("/api/admin/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        electionId,
        count,
        maxUses: reusable ? null : maxUses,
        label: label || null,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not generate codes.");
      return;
    }

    const data = await res.json();
    setGenerated(data.codes.map((c: { plaintextCode: string }) => c.plaintextCode));
    router.refresh();
  }

  function downloadCsv() {
    if (!generated) return;
    const csv = "code\n" + generated.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `access-codes-${electionId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="generate-code-panel">
      <form onSubmit={handleSubmit} className="inline-form">
        <label>
          How many
          <input
            type="number"
            min={1}
            max={500}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
          />
        </label>
        <label>
          <input type="checkbox" checked={reusable} onChange={(e) => setReusable(e.target.checked)} />
          Reusable (unlimited uses)
        </label>
        {!reusable && (
          <label>
            Max uses
            <input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(parseInt(e.target.value, 10) || 1)}
            />
          </label>
        )}
        <label>
          Label (optional)
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Batch 1" />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Generating..." : "Generate"}
        </button>
      </form>

      {generated && (
        <div className="generated-codes">
          <p>
            <strong>{generated.length}</strong> code(s) generated. These are shown only once — copy or download them
            now.
          </p>
          <ul>
            {generated.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
          <button type="button" onClick={downloadCsv}>
            Download CSV
          </button>
        </div>
      )}
    </div>
  );
}
