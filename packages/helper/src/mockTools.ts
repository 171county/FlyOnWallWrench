// Canned read-only tool results for wrenches still in "mock" mode, so the
// cockpit's bays render a rich demo before any real wrench is wired. Shapes
// mirror the real wrench outputs (DefWrench's bw_*/dw_* tools) exactly.

const MINUTE = 60_000;
const ago = (mins: number) => new Date(Date.now() - mins * MINUTE).toISOString();

const DEF_BUILDS = [
  { id: "842", number: 842, status: "failure", branch: "main", title: "Tune factory boss intro timing", finishedAt: ago(34), durationMs: 14 * MINUTE, pipeline: "CI", provider: "github-actions" },
  { id: "841", number: 841, status: "success", branch: "main", title: "Add cutscene asset preload", finishedAt: ago(170), durationMs: 13 * MINUTE, pipeline: "CI", provider: "github-actions" },
  { id: "840", number: 840, status: "success", branch: "feature/boss-arena", title: "Boss arena nav mesh rebake", finishedAt: ago(300), durationMs: 15 * MINUTE, pipeline: "CI", provider: "github-actions" },
  { id: "839", number: 839, status: "failure", branch: "main", title: "Upgrade physics plugin", finishedAt: ago(420), durationMs: 12 * MINUTE, pipeline: "CI", provider: "github-actions" },
  { id: "838", number: 838, status: "success", branch: "main", title: "Localization pass 7", finishedAt: ago(560), durationMs: 14 * MINUTE, pipeline: "CI", provider: "github-actions" },
  { id: "837", number: 837, status: "success", branch: "main", title: "Audio bank rebuild", finishedAt: ago(700), durationMs: 13 * MINUTE, pipeline: "CI", provider: "github-actions" },
];

const NIGHTLY_BUILDS = [
  { id: "311", number: 311, status: "success", branch: "main", title: "Nightly cook + lightmaps", finishedAt: ago(540), durationMs: 96 * MINUTE, pipeline: "Nightly Cook", provider: "github-actions" },
  { id: "310", number: 310, status: "success", branch: "main", title: "Nightly cook + lightmaps", finishedAt: ago(1980), durationMs: 92 * MINUTE, pipeline: "Nightly Cook", provider: "github-actions" },
  { id: "309", number: 309, status: "cancelled", branch: "main", title: "Nightly cook + lightmaps", finishedAt: ago(3420), durationMs: 12 * MINUTE, pipeline: "Nightly Cook", provider: "github-actions" },
];

const DEPLOY_BUILDS = [
  { id: "57", number: 57, status: "success", branch: "release/1.4", title: "Steam depot push 1.4.2", finishedAt: ago(2880), durationMs: 22 * MINUTE, pipeline: "Steam Deploy", provider: "github-actions" },
  { id: "56", number: 56, status: "success", branch: "release/1.4", title: "Steam depot push 1.4.1", finishedAt: ago(10080), durationMs: 21 * MINUTE, pipeline: "Steam Deploy", provider: "github-actions" },
];

const BUILDS_BY_PIPELINE: Record<string, typeof DEF_BUILDS> = {
  "ci.yml": DEF_BUILDS,
  "nightly.yml": NIGHTLY_BUILDS,
  "deploy.yml": DEPLOY_BUILDS,
};

function trendsFor(pipeline: string, builds: typeof DEF_BUILDS) {
  const byStatus: Record<string, number> = {};
  let durSum = 0, durCount = 0;
  for (const b of builds) {
    byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
    if (b.durationMs) { durSum += b.durationMs; durCount++; }
  }
  const success = byStatus.success ?? 0;
  const failure = byStatus.failure ?? 0;
  const decided = success + failure;
  return {
    provider: "github-actions",
    pipeline,
    analyzed: builds.length,
    byStatus,
    successRate: decided ? Math.round((success / decided) * 1000) / 1000 : null,
    avgDurationMs: durCount ? Math.round(durSum / durCount) : null,
    avgDurationMinutes: durCount ? Math.round((durSum / durCount / MINUTE) * 10) / 10 : null,
    recent: builds.map((b) => ({ id: b.id, number: b.number, status: b.status, branch: b.branch, durationMs: b.durationMs })),
  };
}

/**
 * Demo result for a read-only tool on a mock-mode wrench. Returns null for
 * tools we don't have canned data for (the endpoint 501s those).
 */
export function mockToolResult(
  wrenchId: string,
  tool: string,
  args: Record<string, unknown>,
): unknown | null {
  if (wrenchId !== "def") return null;
  switch (tool) {
    case "bw_list_providers":
      return {
        providers: [
          { provider: "github-actions", label: "GitHub Actions", configured: true },
          { provider: "jenkins", label: "Jenkins", configured: false, setup: "Set JENKINS_URL + JENKINS_USER + JENKINS_TOKEN." },
        ],
      };
    case "bw_list_pipelines":
      return {
        provider: "github-actions",
        pipelines: [
          { id: "ci.yml", name: "CI", provider: "github-actions" },
          { id: "nightly.yml", name: "Nightly Cook", provider: "github-actions" },
          { id: "deploy.yml", name: "Steam Deploy", provider: "github-actions" },
        ],
      };
    case "bw_list_builds": {
      const pipeline = String(args.pipeline ?? "ci.yml");
      return { provider: "github-actions", pipeline, builds: BUILDS_BY_PIPELINE[pipeline] ?? DEF_BUILDS };
    }
    case "bw_build_trends": {
      const pipeline = String(args.pipeline ?? "ci.yml");
      return trendsFor(pipeline, BUILDS_BY_PIPELINE[pipeline] ?? DEF_BUILDS);
    }
    case "bw_summarize_failure":
      return {
        provider: "github-actions",
        buildId: String(args.buildId ?? "842"),
        status: "failure",
        failedStep: "Cook content (Win64)",
        errorLines: [
          "LogCook: Error: Couldn't find file for package /Game/Cutscenes/BossIntro requested by async loading code.",
          "LogWindows: Error: NullRef in BossIntroSequence.PlayCutscene()",
          "CookResults: Error: Cook failed — 1 package failed to save.",
        ],
        logTail: "BUILD FAILED — see errors above.",
        totalLogLines: 18423,
        truncated: true,
        note: "Parse-only: these are extracted error candidates, not a verdict.",
      };
    case "dw_status":
      return {
        root: "~/projects/factory-boss (demo)",
        active: [{ productId: "buildwrench", toolCount: 7, meta: { configuredProviders: ["github-actions"] } }],
        failed: [],
      };
    case "dw_correlate":
      return {
        findings: [
          { wrench: "def", kind: "build_failing", title: "CI is failing", detail: 'Latest build #842 failed on main — "Tune factory boss intro timing" (34m ago)', ref: "842", weight: 0.86 },
          { wrench: "def", kind: "failure_signals", title: "Failing at: Cook content (Win64)", detail: "Couldn't find file for package /Game/Cutscenes/BossIntro · NullRef in BossIntroSequence.PlayCutscene()", ref: "842", weight: 0.83 },
        ],
      };
    default:
      return null;
  }
}
