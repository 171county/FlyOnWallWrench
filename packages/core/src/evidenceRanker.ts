import type { EvidenceItem } from "./types.js";

export function scoreEvidence(item: EvidenceItem): number {
  const s = item.confidenceSignals;
  return (
    s.semanticMatch * 0.28 +
    s.exactTermMatch * 0.18 +
    s.recency * 0.16 +
    s.sourceTrust * 0.12 +
    Math.min(s.confirmationCount / 10, 1) * 0.12 +
    s.sameVersionBonus * 0.06 +
    s.resolvedBonus * 0.05 -
    s.duplicatePenalty * 0.08 -
    s.lowQualityPenalty * 0.08
  );
}

export function rankEvidence(items: EvidenceItem[]): EvidenceItem[] {
  return [...items].sort((a, b) => scoreEvidence(b) - scoreEvidence(a));
}

export function aggregateConfidence(items: EvidenceItem[]): number {
  if (items.length === 0) return 0;
  const top = rankEvidence(items).slice(0, 5);
  const avg = top.reduce((sum, item) => sum + scoreEvidence(item), 0) / top.length;
  return Math.max(0, Math.min(1, avg));
}
