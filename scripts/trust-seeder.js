// Marks an account as a TRUSTED SEEDER (may use Shelf scan while it is in tester mode), or removes it.
//   node scripts/trust-seeder.js <email or start of the user id> ["note"]
//   node scripts/trust-seeder.js <email or start of the user id> --remove
//   node scripts/trust-seeder.js --list
// Uses the management API token from passwords/supabase.txt (never the app). Prints ids only, never emails.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const vars = {};
for (const line of fs.readFileSync(path.join(root, "passwords", "supabase.txt"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
  if (m) vars[m[1]] = m[2];
}
const token = vars.SUPABASE_ACCESS_TOKEN;
const ref = (vars.SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!token || !ref) { console.error("Need SUPABASE_ACCESS_TOKEN and SUPABASE_URL in passwords/supabase.txt"); process.exit(1); }

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return text; }
}
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

(async () => {
  const args = process.argv.slice(2);
  if (args.includes("--list")) {
    const rows = await sql("select left(user_id::text, 8) as id, note, created_at from public.trusted_seeders order by created_at");
    console.log(rows.length ? rows : "no trusted seeders yet");
    return;
  }
  const who = args.find((a) => !a.startsWith("--"));
  if (!who) { console.error("Usage: node scripts/trust-seeder.js <email or id prefix> [note] | --remove | --list"); process.exit(1); }
  const where = who.includes("@") ? `lower(email) = lower(${lit(who)})` : `id::text like ${lit(who.toLowerCase() + "%")}`;
  const users = await sql(`select id from auth.users where ${where}`);
  if (!Array.isArray(users) || users.length !== 1) { console.error(`expected exactly one account, found ${Array.isArray(users) ? users.length : "?"}`); process.exit(1); }
  const id = users[0].id;
  if (args.includes("--remove")) {
    await sql(`delete from public.trusted_seeders where user_id = ${lit(id)}`);
    console.log(`removed ${id.slice(0, 8)}… from trusted seeders`);
    return;
  }
  const note = args.filter((a) => !a.startsWith("--")).slice(1).join(" ") || null;
  await sql(`insert into public.trusted_seeders (user_id, note) values (${lit(id)}, ${note ? lit(note) : "null"}) on conflict (user_id) do update set note = excluded.note`);
  console.log(`trusted seeder: ${id.slice(0, 8)}…`);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
