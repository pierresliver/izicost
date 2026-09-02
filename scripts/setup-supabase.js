// One-shot backend setup for IziCost, run by Claude (or PS) after the Supabase access token exists.
//   node scripts/setup-supabase.js schema   -> runs supabase/schema.sql on the project database
//   node scripts/setup-supabase.js auth     -> enables anonymous sign-ins (guest mode)
//   node scripts/setup-supabase.js all      -> both
// Needs passwords/supabase.txt to contain SUPABASE_ACCESS_TOKEN=sbp_... (a personal access token
// from the Supabase dashboard: Account -> Access Tokens). Nothing is printed except status lines.
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
if (!token || !ref) {
  console.error("Need SUPABASE_ACCESS_TOKEN and SUPABASE_URL in passwords/supabase.txt");
  process.exit(1);
}
const api = "https://api.supabase.com/v1/projects/" + ref;
const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };

async function call(method, url, body) {
  const r = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(method + " " + url.replace(api, "") + " -> " + r.status + " " + text.slice(0, 400));
  try { return JSON.parse(text); } catch { return text; }
}

async function schema() {
  const sql = fs.readFileSync(path.join(root, "supabase", "schema.sql"), "utf8");
  await call("POST", api + "/database/query", { query: sql });
  console.log("schema: applied supabase/schema.sql");
  const tables = await call("POST", api + "/database/query", {
    query: "select table_name from information_schema.tables where table_schema='public' order by 1",
  });
  console.log("schema: public tables =", tables.map((t) => t.table_name).join(", "));
}

async function auth() {
  // Anonymous sign-ins = guest mode. mailer_autoconfirm = no confirmation email when a guest
  // upgrades to email+password (same as IziCamera during testing; revisit before public launch).
  await call("PATCH", api + "/config/auth", { external_anonymous_users_enabled: true, mailer_autoconfirm: true });
  const cfg = await call("GET", api + "/config/auth");
  console.log("auth: anonymous sign-ins enabled =", cfg.external_anonymous_users_enabled, "| email autoconfirm =", cfg.mailer_autoconfirm);
}

async function sqlFile(file) {
  const p = path.isAbsolute(file) ? file : path.join(root, file);
  await call("POST", api + "/database/query", { query: fs.readFileSync(p, "utf8") });
  console.log("sql: applied", path.relative(root, p));
}

async function migrations() {
  const dir = path.join(root, "supabase", "migrations");
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await sqlFile(path.join(dir, f));
}

(async () => {
  const what = process.argv[2] || "all";
  try {
    if (what === "schema" || what === "all") await schema();
    if (what === "migrations" || what === "all") await migrations();
    if (what === "auth" || what === "all") await auth();
    if (what === "sql") await sqlFile(process.argv[3]);
  } catch (e) {
    console.error("FAILED:", e.message);
    process.exit(1);
  }
})();
