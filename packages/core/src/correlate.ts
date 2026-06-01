// The spine: thread ONE story across the wrenches.
// community signal (FOTW²) -> mod cause (ModWrench) -> dev fix (DefWrench).
// This is the thing nobody else has: not co-located tabs, a connective tissue.
import type { WrenchBridge, WrenchFinding, WrenchId } from "./wrench.js";

export type WrenchThread = {
  topic: string;
  // ordered findings, strongest first, grouped by wrench in narrative order
  findings: WrenchFinding[];
  // a plain-language story stitched from the findings
  story: string;
  // which wrenches contributed
  contributors: WrenchId[];
  confidence: number;           // 0..1 across the chain
};

const ORDER: WrenchId[] = ["fotw", "mod", "def", "myne"]; // signal -> cause -> fix -> economy

export async function correlate(topic: string, bridges: WrenchBridge[]): Promise<WrenchThread> {
  const all = (await Promise.all(bridges.map((b) => b.findings(topic).catch(() => [])))).flat();

  // Order findings by the narrative spine, then by weight within each wrench.
  const findings = [...all].sort((a, b) => {
    const oa = ORDER.indexOf(a.wrench), ob = ORDER.indexOf(b.wrench);
    if (oa !== ob) return oa - ob;
    return b.weight - a.weight;
  });

  const contributors = [...new Set(findings.map((f) => f.wrench))];
  const confidence = findings.length
    ? Math.min(1, findings.reduce((s, f) => s + f.weight, 0) / Math.max(3, findings.length)) * (0.5 + 0.5 * Math.min(1, contributors.length / 3))
    : 0;

  return { topic, findings, story: buildStory(topic, findings), contributors, confidence };
}

function buildStory(topic: string, findings: WrenchFinding[]): string {
  if (!findings.length) return `No connected wrench findings for "${topic}" yet.`;
  const byWrench = (w: WrenchId) => findings.filter((f) => f.wrench === w);
  const parts: string[] = [];

  const fotw = byWrench("fotw");
  if (fotw.length) parts.push(`Community: ${fotw[0].detail}`);

  const mod = byWrench("mod");
  if (mod.length) parts.push(`Likely cause: ${mod[0].detail}`);

  const def = byWrench("def");
  if (def.length) parts.push(`On the dev side: ${def[0].detail}`);

  const myne = byWrench("myne");
  if (myne.length) parts.push(`Creator impact: ${myne[0].detail}`);

  return parts.join("  →  ");
}
