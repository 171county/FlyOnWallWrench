// prove-discord.mjs — standalone live test for Help Me Comms (no install, Node 18+)
//
// Run it WITHOUT pasting your token into any file:
//
//   macOS/Linux:
//     HM_TOKEN='your-fresh-bot-token' HM_CHANNEL='channel-id' node prove-discord.mjs
//
//   Windows PowerShell:
//     $env:HM_TOKEN='your-fresh-bot-token'; $env:HM_CHANNEL='channel-id'; node prove-discord.mjs
//
// Optional: HM_QUERY='anyone else crashing at the boss?'  (defaults below)
//
// It reads ONLY the one channel you pass, never writes anything, and prints
// real messages flowing through the same logic the extension uses.

const token = process.env.HM_TOKEN?.trim();
const channel = process.env.HM_CHANNEL?.trim();
const query = process.env.HM_QUERY?.trim() || "anyone else crashing or having issues after the patch?";

if (!token || !channel) {
  console.error("Set HM_TOKEN and HM_CHANNEL. See the comment at the top of this file.");
  process.exit(1);
}

const API = "https://discord.com/api/v10";
const headers = { authorization: `Bot ${token}`, "user-agent": "HelpMeCommsBot (flyonwallwrench, 0.1)" };

// --- same intent classifier the brain uses (trimmed) ---
function classifyIntent(t) {
  t = t.toLowerCase();
  if (/(crash|ctd|freeze|fatal|exception|stack trace)/.test(t)) return "crash_support";
  if (/(fps|stutter|bottleneck|lag|cpu|gpu|performance)/.test(t)) return "performance_bottleneck";
  if (/(install|setup|load order|dependency|missing|won'?t load)/.test(t)) return "install_help";
  if (/(known issue|anyone else|others seeing|widespread)/.test(t)) return "known_issue_check";
  return "unknown";
}

async function getMe() {
  const r = await fetch(`${API}/users/@me`, { headers });
  if (!r.ok) throw new Error(`auth check failed (${r.status}) — token may be wrong`);
  return r.json();
}
async function getChannel() {
  const r = await fetch(`${API}/channels/${channel}`, { headers });
  if (r.status === 403) throw new Error("403 — the bot is not in this server, or can't see this channel. Invite it (OAuth2 → bot + View Channels + Read Message History) and use a channel it can see.");
  if (r.status === 404) throw new Error("404 — channel ID not found. Re-copy it (Developer Mode → right-click channel → Copy Channel ID).");
  if (!r.ok) throw new Error(`channel fetch failed (${r.status})`);
  return r.json();
}
async function getMessages(limit = 50) {
  const r = await fetch(`${API}/channels/${channel}/messages?limit=${limit}`, { headers });
  if (!r.ok) throw new Error(`messages fetch failed (${r.status})`);
  return r.json();
}

try {
  const me = await getMe();
  console.log(`\n🤖 Bot authenticated as: ${me.username} (${me.id})`);

  const ch = await getChannel();
  console.log(`📺 Channel: #${ch.name ?? channel}`);

  const msgs = (await getMessages(50)).filter((m) => !m.author?.bot && (m.content ?? "").trim());
  console.log(`\n=== Recent human messages (${msgs.length}) ===`);
  for (const m of msgs.slice(0, 8)) {
    console.log(`  • ${m.author?.username ?? "?"}: ${m.content.slice(0, 90).replace(/\n/g, " ")}`);
  }
  if (msgs.length === 0) {
    console.log("  (channel readable, but no human messages — post a couple, or check Message Content Intent is ON)");
  }

  const terms = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const hits = msgs.filter((m) => { const l = m.content.toLowerCase(); return terms.some((t) => l.includes(t)); });
  const intent = classifyIntent(query);

  console.log(`\n=== community_help on LIVE Discord ===`);
  console.log(`question : "${query}"`);
  console.log(`intent   : ${intent}`);
  console.log(`matches  : ${hits.length} of ${msgs.length} recent messages mention it`);
  const prevalence = msgs.length ? Math.round((hits.length / msgs.length) * 100) : 0;
  console.log(`prevalence: ${prevalence}%  ${prevalence >= 25 ? "→ looks widespread" : "→ looks isolated so far"}`);
  for (const h of hits.slice(0, 5)) console.log(`   ↳ ${h.author?.username}: ${h.content.slice(0, 80).replace(/\n/g, " ")}`);

  console.log(`\n✅ LIVE Discord data flowed through the Help Me pipeline. Reset the token when done.\n`);
} catch (e) {
  console.error(`\n❌ ${e.message}\n`);
  process.exit(1);
}
