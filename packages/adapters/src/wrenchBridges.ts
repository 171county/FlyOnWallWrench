// Mock wrench bridges for the cockpit demo. Each mirrors the real read-only
// slice its wrench would expose. Real MCP-backed bridges (talking to the actual
// ModWrench/DefWrench/MyneWrench servers via a local helper) drop in behind the
// same WrenchBridge interface later — same playbook as FOTW²'s source adapters.
import type { WrenchBridge, WrenchFinding, WrenchStation } from "@help-me-comms/core";

const hit = (topic: string, terms: string[]) => {
  const t = topic.toLowerCase();
  return terms.some((w) => t.includes(w));
};

export const MOD_STATION: WrenchStation = { id: "mod", label: "ModWrench", tagline: "Every mod platform · load order · crashlog", color: "#4cc2ff", available: true };
export const DEF_STATION: WrenchStation = { id: "def", label: "DefWrench", tagline: "Studio toolchain · builds · tickets", color: "#e0964a", available: true };
export const MYNE_STATION: WrenchStation = { id: "myne", label: "MyneWrench", tagline: "Creator economies · Roblox · UEFN", color: "#2ee06a", available: true };
export const FOTW_STATION: WrenchStation = { id: "fotw", label: "FOTW²", tagline: "Community brain · the cockpit", color: "#7d88c8", available: true };

export class MockModBridge implements WrenchBridge {
  id = "mod" as const;
  station = MOD_STATION;
  async findings(topic: string): Promise<WrenchFinding[]> {
    const out: WrenchFinding[] = [];
    if (hit(topic, ["crash", "ctd", "boss", "freeze"])) {
      out.push({ wrench: "mod", kind: "load_order_hit", title: "Suspect mod in load order", detail: "Your load order has 'HD Texture Pack v3.1' enabled — recently updated and flagged in crashlogs at the same frame.", ref: "HD Texture Pack v3.1", weight: 0.85 });
      out.push({ wrench: "mod", kind: "crashlog", title: "Crashlog top frame", detail: "Last crashlog: NullRef in BossIntroSequence.PlayCutscene() — points to a missing cutscene asset.", ref: "crash.log", weight: 0.7 });
    }
    if (hit(topic, ["performance", "fps", "stutter", "bottleneck"])) {
      out.push({ wrench: "mod", kind: "load_order_hit", title: "Heavy script mod", detail: "Two script-heavy mods load late in your order; common cause of city-area stutter.", ref: "script mods", weight: 0.6 });
    }
    return out;
  }
}

export class MockDevBridge implements WrenchBridge {
  id = "def" as const;
  station = DEF_STATION;
  async findings(topic: string): Promise<WrenchFinding[]> {
    const out: WrenchFinding[] = [];
    if (hit(topic, ["crash", "ctd", "boss", "asset", "cutscene"])) {
      out.push({ wrench: "def", kind: "open_ticket", title: "Matching Jira ticket", detail: "GAME-1423 'Boss intro cutscene asset removed in 1.4.2' is open and assigned — directly matches the crashlog.", ref: "GAME-1423", weight: 0.8 });
      out.push({ wrench: "def", kind: "build", title: "Last build touched it", detail: "Jenkins build #842 (last night) modified /assets/cutscenes/boss_intro — status: passing.", ref: "#842", weight: 0.55 });
    }
    return out;
  }
}

export class MockCreatorBridge implements WrenchBridge {
  id = "myne" as const;
  station = MYNE_STATION;
  async findings(topic: string): Promise<WrenchFinding[]> {
    const out: WrenchFinding[] = [];
    if (hit(topic, ["crash", "review", "refund", "rating"])) {
      out.push({ wrench: "myne", kind: "economy", title: "Creator impact", detail: "Your Roblox experience's session length dipped this week and refund-flavored reviews are up — same window as the crash spike.", ref: "experience", weight: 0.4 });
    }
    return out;
  }
}

export function createMockWrenchBridges(): WrenchBridge[] {
  return [new MockModBridge(), new MockDevBridge(), new MockCreatorBridge()];
}
