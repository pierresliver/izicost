// Moves every receipt (lines + photos) from one account to another, e.g. an old guest → PS's real account.
//   node scripts/move-receipts.js <source user id or prefix> <target email or id prefix>
// Photos are moved inside the private bucket to the target's folder (RLS only lets a user see their own folder)
// and receipts.image_path is rewritten. Uses the management token (SQL) and the service key (storage). Prints ids only.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const vars = {};
for (const line of fs.readFileSync(path.join(root, "passwords", "supabase.txt"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
  if (m) vars[m[1]] = m[2];
}
const ref = (vars.SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!vars.SUPABASE_ACCESS_TOKEN || !vars.SUPABASE_SECRET_KEY || !ref) { console.error("Need SUPABASE_ACCESS_TOKEN, SUPABASE_SECRET_KEY and SUPABASE_URL in passwords/supabase.txt"); process.exit(1); }

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${vars.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`SQL ${r.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return []; }
}
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
async function movePhoto(from, to) {
  const r = await fetch(`${vars.SUPABASE_URL}/storage/v1/object/move`, {
    method: "POST", headers: { Authorization: `Bearer ${vars.SUPABASE_SECRET_KEY}`, apikey: vars.SUPABASE_SECRET_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ bucketId: "receipts", sourceKey: from, destinationKey: to }),
  });
  if (!r.ok) throw new Error(`move ${from.slice(-20)}: ${r.status} ${(await r.text()).slice(0, 200)}`);
}

(async () => {
  const [src, dst] = process.argv.slice(2);
  if (!src || !dst) { console.error("Usage: node scripts/move-receipts.js <source id/prefix> <target email or id/prefix>"); process.exit(1); }
  const findUser = async (who) => {
    const where = who.includes("@") ? `lower(email) = lower(${lit(who)})` : `id::text like ${lit(who.toLowerCase() + "%")}`;
    const rows = await sql(`select id from auth.users where ${where}`);
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error(`expected exactly one account for "${who.includes("@") ? "(email)" : who}", found ${rows.length ?? "?"}`);
    return rows[0].id;
  };
  const from = await findUser(src), to = await findUser(dst);
  if (from === to) throw new Error("source and target are the same account");
  const receipts = await sql(`select id, image_path from public.receipts where user_id = ${lit(from)}`);
  console.log(`moving ${receipts.length} receipts from ${from.slice(0, 8)}… to ${to.slice(0, 8)}…`);
  let photos = 0;
  for (const r of receipts) {
    const paths = (r.image_path || "").split("|").map((p) => p.trim()).filter(Boolean);
    const moved = [];
    for (const p of paths) {
      const dest = `${to}/${p.split("/").pop()}`;
      try { await movePhoto(p, dest); moved.push(dest); photos++; }
      catch (e) { console.warn(`  photo skipped: ${e.message}`); }
    }
    const newPath = moved.length ? lit(moved.join("|")) : "null";
    await sql(`update public.receipts set user_id = ${lit(to)}, image_path = ${newPath} where id = ${lit(r.id)};
               update public.receipt_items set user_id = ${lit(to)} where receipt_id = ${lit(r.id)};`);
  }
  console.log(`done: ${receipts.length} receipts, ${photos} photos moved`);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
