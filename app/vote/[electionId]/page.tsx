import { CodeEntryForm } from "@/components/voter/code-entry-form";
import "../vote.css";

export default function VoterVerifyPage({ params }: { params: { electionId: string } }) {
  return (
    <main className="vote-shell">
      <div className="vote-card">
        <div className="vote-brand">
          <img src="/brand/logo.png" alt="Eligo" />
          <span>Eligo</span>
        </div>
        <h1>Enter your access code</h1>
        <p>You should have received a unique code from the election organizer.</p>
        <CodeEntryForm electionId={params.electionId} />
      </div>
    </main>
  );
}
