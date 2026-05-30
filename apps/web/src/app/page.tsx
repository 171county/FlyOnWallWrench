import AskConsole from "./AskConsole";

const cards = [
  { icon: "✦", accent: "#4cc2ff", title: "Help Me Inbox", body: "Incoming questions, noisy threads, crash reports, and community spikes in one queue." },
  { icon: "◎", accent: "#7d88c8", title: "Evidence", body: "Scoped, redacted evidence from connected sources. Ephemeral by default." },
  { icon: "✎", accent: "#e0964a", title: "Drafts & Approvals", body: "Replies, posts, polls, and issue drafts wait here for visible user approval." },
  { icon: "▤", accent: "#2ee06a", title: "Known Issues", body: "Repeated help requests cluster into FAQs and known-issue drafts." },
  { icon: "✺", accent: "#4cc2ff", title: "Idea Board", body: "Feature requests and community ideas pulled into ranked cards." },
  { icon: "⚙", accent: "#e0964a", title: "Provider & Sources", body: "Connect sources and choose a provider — no sensitive data stored in the MCP." },
];

export default function Page() {
  return (
    <main className="wrap">
      <div className="topbar">
        <div className="brand">
          <div className="logo">&lt;/&gt;</div>
          <div>
            <div className="kicker">FlyOnWall · Community Brain</div>
            <div className="title">Help Me Comms</div>
          </div>
        </div>
        <span className="statuspill"><span className="led" /> Mock sources online</span>
      </div>

      <section className="hero">
        <h2>Ask what the community is <span className="acc">actually saying</span>.</h2>
        <p>Troubleshoot, correlate issues across Discord, Reddit, Steam and forums, draft a reply, or pull ideas — with approval-first actions and ephemeral evidence.</p>
      </section>

      <AskConsole />

      <div className="section-head">Workspace</div>
      <section className="cardgrid">
        {cards.map((c) => (
          <article className="feature glass" key={c.title} style={{ ["--fa" as string]: c.accent }}>
            <div className="fic">{c.icon}</div>
            <h3>{c.title}</h3>
            <p>{c.body}</p>
          </article>
        ))}
      </section>

      <p className="hostnote">
        Team host · for a single dev or modder, the browser &amp; VS Code side panels run this on their own — no tab required.
      </p>
    </main>
  );
}
