"use client";

import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface CountLogTally {
  name: string;
  party: string | null;
  votes: number;
  status: string;
}

interface CountLogTransferIn {
  name: string;
  amount: number;
}

interface CountLogRound {
  number: number;
  action: string;
  note: string;
  tallies: CountLogTally[];
  transfersIn: CountLogTransferIn[];
  transferExhausted: number;
}

interface FptpCountLogTally {
  name: string;
  party: string | null;
  votes: number;
  status: string;
}

interface PrCountLogCandidate {
  firstName: string;
  lastName: string;
  rank: number;
  status: string;
}

interface PrCountLogList {
  name: string;
  abbreviation: string;
  votes: number;
  votePercent: number;
  seatsWon: number;
  idealSeats: number;
  excludedByThreshold: boolean;
  candidates: PrCountLogCandidate[];
}

interface PrCountLogTieBreak {
  seatNumber: number;
  tiedListNames: string[];
  winnerName: string;
  method: string;
}

interface ElectionCountLog {
  electionTitle: string;
  votingSystem: string;
  startedAt: string | null;
  endedAt: string | null;
  quota?: number;
  totalValidVotes: number;
  seats: number;
  rounds?: CountLogRound[];
  tallies?: FptpCountLogTally[];
  lists?: PrCountLogList[];
  blankVotes?: number;
  threshold?: number;
  tieBreaks?: PrCountLogTieBreak[];
  winners: { name: string; party: string | null }[];
}

const VOTING_SYSTEM_LABELS: Record<string, string> = {
  STV: "Single Transferable Vote (STV)",
  FPTP: "First Past the Post (FPTP)",
  PR: "Proportional Representation",
};

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "Not recorded";
}

function fmtNum(n: number): string {
  return String(Math.round(n * 10000) / 10000);
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

/** jspdf-autotable attaches this to the document instance at runtime; cast rather than rely on ambient module augmentation being picked up. */
function getLastAutoTableFinalY(doc: jsPDF, fallback: number): number {
  const withTable = doc as unknown as { lastAutoTable?: { finalY: number } };
  return withTable.lastAutoTable?.finalY ?? fallback;
}

export function ElectionCountLogButton({ electionId }: { electionId: string }) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/elections/${electionId}/election-count-log`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not load the election count log.");
      }
      const log: ElectionCountLog = await res.json();

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginLeft = 14;
      const contentWidth = pageWidth - marginLeft * 2;
      const pageBottom = 280;

      try {
        const logoDataUrl = await loadImageAsDataUrl("/brand/logo.png");
        doc.addImage(logoDataUrl, "PNG", marginLeft, 10, 14, 14);
      } catch {
        // Logo is decorative -- fall through and generate the PDF without it.
      }

      doc.setFontSize(18);
      doc.text("Election count Log", marginLeft + 18, 20);

      doc.setFontSize(11);
      let y = 32;
      doc.text(`Ballot: ${log.electionTitle}`, marginLeft, y);
      y += 7;
      doc.text(`Actual start date: ${formatDate(log.startedAt)}`, marginLeft, y);
      y += 7;
      doc.text(`Actual end date: ${formatDate(log.endedAt)}`, marginLeft, y);
      y += 7;
      doc.text(`Ballot type: ${VOTING_SYSTEM_LABELS[log.votingSystem] ?? log.votingSystem}`, marginLeft, y);
      y += 10;

      function ensureSpace(neededHeight: number) {
        if (y + neededHeight > pageBottom) {
          doc.addPage();
          y = 20;
        }
      }

      if (log.votingSystem === "PR" && log.lists) {
        doc.setFontSize(9);
        doc.text(
          `${log.totalValidVotes} valid vote(s)${log.blankVotes ? `, ${log.blankVotes} blank vote(s)` : ""}. Threshold: ${log.threshold}%.`,
          marginLeft,
          y
        );
        y += 8;

        autoTable(doc, {
          startY: y,
          head: [["List", "Votes", "%", "Seats won (raw)", "Status"]],
          body: log.lists.map((l) => [
            `${l.name} (${l.abbreviation})`,
            String(l.votes),
            `${fmtNum(l.votePercent)}%`,
            `${l.seatsWon} (${l.idealSeats.toFixed(1)})`,
            l.excludedByThreshold ? "Excluded (below threshold)" : "Eligible",
          ]),
          styles: { fontSize: 9 },
          headStyles: { fillColor: [8, 77, 73] },
          margin: { left: marginLeft, right: marginLeft },
        });
        y = getLastAutoTableFinalY(doc, y) + 6;

        for (const list of log.lists) {
          ensureSpace(20);
          doc.setFontSize(13);
          doc.text(`${list.name} (${list.abbreviation})`, marginLeft, y);
          y += 6;

          autoTable(doc, {
            startY: y,
            head: [["Rank", "Candidate", "Status"]],
            body: list.candidates.map((c) => [String(c.rank), `${c.firstName} ${c.lastName}`, c.status]),
            styles: { fontSize: 9 },
            headStyles: { fillColor: [8, 77, 73] },
            margin: { left: marginLeft, right: marginLeft },
          });
          y = getLastAutoTableFinalY(doc, y) + 8;
        }

        if (log.tieBreaks && log.tieBreaks.length > 0) {
          ensureSpace(12);
          doc.setFontSize(9);
          for (const t of log.tieBreaks) {
            const line = `Seat ${t.seatNumber}: tie between ${t.tiedListNames.join(", ")}, resolved in favor of ${t.winnerName} (${t.method === "votes" ? "more total votes" : "random draw"}).`;
            const lines = doc.splitTextToSize(line, contentWidth);
            doc.text(lines, marginLeft, y);
            y += lines.length * 5 + 2;
          }
        }
      } else if (log.votingSystem === "FPTP" && log.tallies) {
        autoTable(doc, {
          startY: y,
          head: [["Candidate", "Party", "Votes", "Status"]],
          body: log.tallies.map((t) => [t.name, t.party ?? "", String(t.votes), t.status]),
          styles: { fontSize: 9 },
          headStyles: { fillColor: [8, 77, 73] },
          margin: { left: marginLeft, right: marginLeft },
        });
        y = getLastAutoTableFinalY(doc, y) + 6;
      } else {
        for (const round of log.rounds ?? []) {
          ensureSpace(20);

          doc.setFontSize(13);
          doc.text(`Round ${round.number} — ${round.action}`, marginLeft, y);
          y += 6;

          autoTable(doc, {
            startY: y,
            head: [["Candidate", "Party", "Votes", "Status"]],
            body: round.tallies.map((t) => [t.name, t.party ?? "", fmtNum(t.votes), t.status]),
            styles: { fontSize: 9 },
            headStyles: { fillColor: [8, 77, 73] },
            margin: { left: marginLeft, right: marginLeft },
          });
          y = getLastAutoTableFinalY(doc, y) + 6;

          ensureSpace(12);
          doc.setFontSize(9);
          const noteLines = doc.splitTextToSize(round.note, contentWidth);
          doc.text(noteLines, marginLeft, y);
          y += noteLines.length * 5 + 2;

          if (round.transfersIn.length > 0 || round.transferExhausted > 1e-9) {
            const parts = round.transfersIn.map((t) => `${t.name} +${fmtNum(t.amount)}`);
            if (round.transferExhausted > 1e-9) {
              parts.push(`exhausted +${fmtNum(round.transferExhausted)}`);
            }
            ensureSpace(10);
            const transferLines = doc.splitTextToSize(`Transferred: ${parts.join(", ")}`, contentWidth);
            doc.text(transferLines, marginLeft, y);
            y += transferLines.length * 5 + 6;
          } else {
            y += 6;
          }
        }
      }

      const safeTitle = log.electionTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      doc.save(`election-count-log-${safeTitle}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the election count log.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="voting-log-control">
      <button type="button" onClick={handleClick} disabled={generating}>
        {generating ? "Generating..." : "Election count Log"}
      </button>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
