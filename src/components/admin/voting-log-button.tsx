"use client";

import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface VotingLogCandidate {
  id: string;
  name: string;
  party: string | null;
}

interface VotingLogBallot {
  ballotNumber: number;
  ranking: string[];
}

interface VotingLog {
  electionTitle: string;
  startedAt: string | null;
  endedAt: string | null;
  candidates: VotingLogCandidate[];
  ballots: VotingLogBallot[];
}

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "Not recorded";
}

async function loadImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read logo image."));
    reader.readAsDataURL(blob);
  });
}

export function VotingLogButton({ electionId }: { electionId: string }) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/elections/${electionId}/voting-log`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not load the voting log.");
      }
      const log: VotingLog = await res.json();

      const doc = new jsPDF({ orientation: "landscape" });

      try {
        const logoDataUrl = await loadImageAsDataUrl("/brand/logo.png");
        doc.addImage(logoDataUrl, "PNG", 14, 10, 14, 14);
      } catch {
        // Logo is decorative -- fall through and generate the PDF without it.
      }

      doc.setFontSize(18);
      doc.text("Voting log", 32, 20);

      doc.setFontSize(11);
      let y = 32;
      doc.text(`Ballot: ${log.electionTitle}`, 14, y);
      y += 7;
      doc.text(`Actual start date: ${formatDate(log.startedAt)}`, 14, y);
      y += 7;
      doc.text(`Actual end date: ${formatDate(log.endedAt)}`, 14, y);
      y += 8;

      const head = [["Ballot #", ...log.candidates.map((c) => c.name)]];
      const body = log.ballots.map((b) => {
        const row = [String(b.ballotNumber)];
        for (const c of log.candidates) {
          const preference = b.ranking.indexOf(c.id);
          row.push(preference === -1 ? "" : String(preference + 1));
        }
        return row;
      });

      autoTable(doc, {
        startY: y,
        head,
        body,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [8, 77, 73] },
      });

      const safeTitle = log.electionTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      doc.save(`voting-log-${safeTitle}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the voting log.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="voting-log-control">
      <button type="button" onClick={handleClick} disabled={generating}>
        {generating ? "Generating..." : "Voting log"}
      </button>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
