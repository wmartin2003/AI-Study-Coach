// Invite-code and spend management CLI. Run locally against the project's
// `.env` (never committed) — this talks to Supabase with the service-role
// key, so it must never run anywhere but a trusted machine.
//
// Usage:
//   pnpm --filter @workspace/scripts run invites -- generate [count] [note]
//   pnpm --filter @workspace/scripts run invites -- list
//   pnpm --filter @workspace/scripts run invites -- spend

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Minimal .env loader — this package has no dotenv dependency, and adding
// one just for this script isn't worth it. Only used when the shell hasn't
// already exported these vars (e.g. `pnpm dev` for the API server relies on
// the same convention — see README.md).
function loadEnvFile(path: string) {
  let contents: string;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(resolve(__dirname, "../../.env"));

const url = process.env["SUPABASE_URL"];
const secretKey = process.env["SUPABASE_SECRET_KEY"];
if (!url || !secretKey) {
  console.error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set (copy .env.example to .env and fill them in).");
  process.exit(1);
}

const supabase = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });

// Readable codes ("quiet-otter-4821") — these get read off a poster or
// handed over in a text message, so words beat a UUID. Not meant to be
// unguessable on their own; max_uses + expires_at do the real work.
const ADJECTIVES = [
  "quiet", "bright", "swift", "calm", "bold", "sunny", "brisk", "gentle", "keen", "lively",
  "merry", "nimble", "proud", "sharp", "steady", "vivid", "warm", "wise", "cozy", "eager",
];
const NOUNS = [
  "otter", "falcon", "maple", "harbor", "comet", "willow", "canyon", "ember", "meadow", "ridge",
  "aspen", "heron", "lagoon", "summit", "thistle", "beacon", "cedar", "delta", "orchid", "prairie",
];

function randomFrom<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

function generateCode(): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${randomFrom(ADJECTIVES)}-${randomFrom(NOUNS)}-${digits}`;
}

async function cmdGenerate(count: number, note: string | null) {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) codes.push(generateCode());

  const { error } = await supabase.from("invite_codes").insert(codes.map((code) => ({ code, note, max_uses: 1 })));
  if (error) {
    console.error("Failed to create invite codes:", error.message);
    process.exit(1);
  }

  console.log(`Created ${count} invite code(s)${note ? ` (${note})` : ""}:\n`);
  for (const code of codes) console.log(`  ${code}`);
}

async function cmdList() {
  const { data, error } = await supabase
    .from("invite_codes")
    .select("code, note, max_uses, used_count, expires_at, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to list invite codes:", error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.log("No invite codes yet. Run `invites generate` to create some.");
    return;
  }

  const rows = data.map((row) => ({
    code: row.code,
    uses: `${row.used_count}/${row.max_uses}`,
    status: row.used_count >= row.max_uses ? "used up" : row.expires_at && new Date(row.expires_at) < new Date() ? "expired" : "available",
    expires: row.expires_at ? new Date(row.expires_at).toISOString().slice(0, 10) : "—",
    note: row.note ?? "",
  }));

  console.table(rows);
}

async function cmdSpend() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const { data: usage, error } = await supabase
    .from("ai_usage")
    .select("user_id, feature, estimated_cost_usd")
    .gte("occurred_at", monthStart);
  if (error) {
    console.error("Failed to read usage:", error.message);
    process.exit(1);
  }

  const { data: state } = await supabase.from("ai_service_state").select("paused, monthly_budget_usd").eq("id", 1).maybeSingle();

  const byUser = new Map<string, number>();
  let total = 0;
  for (const row of usage ?? []) {
    const cost = Number(row.estimated_cost_usd);
    total += cost;
    byUser.set(row.user_id, (byUser.get(row.user_id) ?? 0) + cost);
  }

  const userIds = [...byUser.keys()];
  const emailById = new Map<string, string>();
  for (const userId of userIds) {
    const { data } = await supabase.auth.admin.getUserById(userId);
    if (data?.user?.email) emailById.set(userId, data.user.email);
  }

  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  console.log(`\nAI spend for ${monthLabel}`);
  console.log(`Global budget: $${Number(state?.monthly_budget_usd ?? 40).toFixed(2)} — ${state?.paused ? "PAUSED" : "active"}\n`);

  const rows = [...byUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([userId, cost]) => ({ user: emailById.get(userId) ?? userId, spend: `$${cost.toFixed(4)}` }));

  if (rows.length === 0) {
    console.log("No AI usage recorded yet this month.");
  } else {
    console.table(rows);
  }

  console.log(`\nTotal this month: $${total.toFixed(4)} of $${Number(state?.monthly_budget_usd ?? 40).toFixed(2)}`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "generate": {
      const count = Number(args[0] ?? 1);
      const note = args[1] ?? null;
      if (!Number.isInteger(count) || count < 1) {
        console.error("Usage: invites generate [count] [note]");
        process.exit(1);
      }
      await cmdGenerate(count, note);
      break;
    }
    case "list":
      await cmdList();
      break;
    case "spend":
      await cmdSpend();
      break;
    default:
      console.log("Usage:");
      console.log("  invites generate [count] [note]   Create one or more single-use invite codes");
      console.log("  invites list                       List all invite codes and their usage");
      console.log("  invites spend                       Show this month's AI spend, per user and total");
      process.exit(command ? 1 : 0);
  }
}

main();
