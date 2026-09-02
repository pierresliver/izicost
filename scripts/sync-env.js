// Writes app/.env from passwords/supabase.txt, copying ONLY the two public values the app needs.
// The secret key and the database password are never copied.  Run:  node scripts/sync-env.js
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const src = path.join(root, "passwords", "supabase.txt");
const dst = path.join(root, "app", ".env");

if (!fs.existsSync(src)) {
  console.error("Missing " + src);
  process.exit(1);
}
const vars = {};
for (const line of fs.readFileSync(src, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
  if (m) vars[m[1]] = m[2];
}
const url = vars.SUPABASE_URL;
const pub = vars.SUPABASE_PUBLISHABLE_KEY || vars.SUPABASE_ANON_KEY;
if (!url || !pub) {
  console.error("supabase.txt must contain SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}
if (!/^sb_publishable_|^eyJ/.test(pub)) {
  console.error("That does not look like a publishable/anon key; refusing to write it into the app.");
  process.exit(1);
}
fs.writeFileSync(dst, `EXPO_PUBLIC_SUPABASE_URL=${url}\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${pub}\n`);
console.log("wrote app/.env (url + publishable key only)");
