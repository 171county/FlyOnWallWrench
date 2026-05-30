"use client";

import { useLayoutEffect, useRef, useState } from "react";

type SuggestedAction = { type: string; label: string; requiresApproval?: boolean };
type EvidenceItem = { source: string; title?: string; summary?: string; confidenceSignals?: { confirmationCount?: number } };
type HelpAnswer = {
  status?: string; intent?: string; confidence?: number; answer?: string; followupQuestion?: string;
  sourcesUsed?: string[]; evidence?: EvidenceItem[]; suggestedActions?: SuggestedAction[]; privacyNotice?: string;
};

const SOURCE_META: Record<string, { label: string; color: string }> = {
  discord: { label: "Discord", color: "#5865f2" },
  reddit: { label: "Reddit", color: "#ff4500" },
  steam_reviews: { label: "Steam", color: "#66c0f4" },
  steam_news: { label: "Steam News", color: "#66c0f4" },
  forum: { label: "Forum", color: "#2ee06a" },
  github_discussions: { label: "GitHub", color: "#c9d1d9" },
  github_issues: { label: "GitHub Issues", color: "#c9d1d9" },
  youtube: { label: "YouTube", color: "#ff4d9d" },
  twitch: { label: "Twitch", color: "#8b5cff" },
  slack: { label: "Slack", color: "#36c5f0" },
  matrix: { label: "Matrix", color: "#0dbd8b" },
};

const TABS = [
  { id: "answer", label: "Answer", accent: "#7d88c8" },
  { id: "evidence", label: "Evidence", accent: "#e0964a" },
  { id: "actions", label: "Actions", accent: "#2ee06a" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function meta(source: string) {
  return SOURCE_META[source] ?? { label: source, color: "#9aa6c4" };
}

export default function AskConsole() {
  const [question, setQuestion] = useState("I'm crashing at the factory boss intro. What do I do?");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [data, setData] = useState<HelpAnswer | null>(null);
  const [tab, setTab] = useState<TabId>("answer");

  const barRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [ind, setInd] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  const showResult = loading || error || data;
  const activeAccent = TABS.find((t) => t.id === tab)?.accent ?? "#4cc2ff";

  useLayoutEffect(() => {
    const btn = tabRefs.current[tab];
    if (btn) setInd({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [tab, showResult]);

  async function ask() {
    const message = question.trim();
    if (!message) return;
    setLoading(true); setError(false); setData(null); setTab("answer");
    try {
      const res = await fetch("/api/community-help", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_message: message, source_policy: "auto_scope_connected_sources" }),
      });
      setData(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const pct = data?.confidence != null ? Math.round(data.confidence * 100) : 0;

  return (
    <div className="console glass lux">
      <div className="composer">
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask the community brain…" />
        <div className="composer-bar">
          <span className="hint">Scopes connected sources · drafts are approval-gated · evidence is ephemeral</span>
          <button className="primary" onClick={ask} disabled={loading}>{loading ? "Thinking…" : "Ask Help Me ✦"}</button>
        </div>
      </div>

      {showResult && (
        <>
          <div className="tabbar" ref={barRef} style={{ ["--tab-accent" as string]: activeAccent }}>
            <span className="tab-ind" style={{ transform: `translateX(${ind.left}px)`, width: ind.width }} />
            {TABS.map((t) => (
              <button
                key={t.id}
                ref={(el) => { tabRefs.current[t.id] = el; }}
                className="tab"
                data-on={tab === t.id}
                style={{ ["--ta" as string]: t.accent }}
                onClick={() => setTab(t.id)}
              >
                <span className="led" />{t.label}
              </button>
            ))}
          </div>

          <div className="views" style={{ ["--tab-accent" as string]: activeAccent }}>
            {loading && (
              <div className="view" data-on={true}>
                <div className="skel" style={{ width: "40%" }} />
                <div className="skel" style={{ width: "90%" }} />
                <div className="skel" style={{ width: "70%" }} />
              </div>
            )}
            {error && (
              <div className="view" data-on={true}>
                <div className="errline">Couldn&apos;t reach <b>/api/community-help</b>. Is the web app running?</div>
              </div>
            )}
            {!loading && !error && data && (
              <>
                <div className="view" data-on={tab === "answer"}>
                  <div className="chiprow">
                    <span className={"chip status" + (data.status === "ok" ? " ok" : "")}>{(data.status ?? "ok").replace(/_/g, " ")}</span>
                    {data.intent && <span className="chip">{data.intent.replace(/_/g, " ")}</span>}
                  </div>
                  {data.answer && <div className="answer">{data.answer}</div>}
                  {data.followupQuestion && (
                    <div className="followup"><span className="q">✦</span><span>{data.followupQuestion}</span></div>
                  )}
                </div>

                <div className="view" data-on={tab === "evidence"}>
                  {data.confidence != null && (
                    <div>
                      <div className="meter-label">Confidence</div>
                      <div className="meter-wrap">
                        <div className="meter"><i style={{ width: `${pct}%` }} /></div>
                        <span className="meter-val">{pct}%</span>
                      </div>
                    </div>
                  )}
                  {!!data.sourcesUsed?.length && (
                    <div>
                      <div className="section-label" style={{ marginBottom: 8 }}>Sources scoped</div>
                      <div className="pills">
                        {data.sourcesUsed.map((s) => (
                          <span className="pill" key={s}><span className="led" style={{ color: meta(s).color }} />{meta(s).label}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {!!data.evidence?.length && (
                    <div>
                      <div className="section-label" style={{ marginBottom: 8 }}>Top evidence</div>
                      <div className="evlist">
                        {data.evidence.slice(0, 3).map((item, i) => (
                          <div className="ev" key={i}>
                            <div className="evtop"><span className="evdot" style={{ color: meta(item.source).color }} /><span className="evsrc">{meta(item.source).label}</span></div>
                            <div className="evsum">{item.summary ?? item.title}</div>
                            {item.confidenceSignals?.confirmationCount != null && (
                              <div className="evmeta">{item.source} · {item.confidenceSignals.confirmationCount} confirmations</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.privacyNotice && <div className="privacy"><span className="dot" />{data.privacyNotice}</div>}
                </div>

                <div className="view" data-on={tab === "actions"}>
                  <div className="section-label">Suggested next actions</div>
                  <div className="acts">
                    {(data.suggestedActions ?? []).map((a, i) => (
                      <button className="act" key={i}><span className="glyph">✎</span><span>{a.label}</span>{a.requiresApproval && <span className="gate">Approval</span>}</button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
