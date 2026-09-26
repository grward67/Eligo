export default function HomePage() {
  return (
    <main
      style={{
        maxWidth: 480,
        margin: "80px auto",
        padding: 24,
        textAlign: "center",
        color: "var(--color-base-content)",
      }}
    >
      <img src="/brand/logo.png" alt="Oenach" style={{ height: 56, width: 56, borderRadius: 12 }} />
      <h1>Oenach Voting</h1>
      <p>Voters: use the link provided by your election organizer to vote.</p>
      <p>
        <a href="/admin/login" style={{ color: "var(--color-secondary)", fontWeight: 600 }}>
          Admin sign in
        </a>
      </p>
      <p>
        <a href="https://oenach.com" style={{ color: "var(--color-base-content-tertiary)", fontSize: "0.85rem" }}>
          oenach.com
        </a>
      </p>
    </main>
  );
}
