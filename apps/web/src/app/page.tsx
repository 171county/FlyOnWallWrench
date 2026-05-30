const cards = [
  {
    title: "Help Me Inbox",
    body: "Incoming support questions, noisy threads, crash reports, and community spikes.",
  },
  {
    title: "Evidence",
    body: "Scoped, redacted evidence from connected communication sources. Default handling is ephemeral.",
  },
  {
    title: "Drafts & Approvals",
    body: "Replies, posts, polls, issue drafts, and local actions wait here for visible user approval.",
  },
  {
    title: "Known Issues",
    body: "Repeated issues cluster into FAQs and known-issue drafts.",
  },
  {
    title: "Idea Board",
    body: "Pull feature requests and community ideas into ranked cards.",
  },
  {
    title: "Provider & Sources",
    body: "Connect sources, choose provider mode, and manage permissions without storing sensitive data in the MCP.",
  },
];

export default function Page() {
  return (
    <main>
      <p className="badge">Codex scaffold</p>
      <p className="badge">Comms only</p>
      <p className="badge">Approval-first</p>
      <h1>Help Me Comms</h1>
      <p>
        A conversational community support and communications workspace for game developers and modders.
      </p>
      <section className="grid">
        {cards.map((card) => (
          <article className="card" key={card.title}>
            <h2>{card.title}</h2>
            <p>{card.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
