// Publishes an APK as the current release: uploads it to the public "releases" bucket (as izicost-latest.apk
// and izicost-v<version>.apk) and writes latest.json, which the app's "Update available" check reads.
//   node scripts/publish-release.js builds\izicost-v0.3.1-2026-09-03-2010.apk ["release notes"]
// Uses the service key from passwords/supabase.txt (never the app). Prints URLs only.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const vars = {};
for (const line of fs.readFileSync(path.join(root, "passwords", "supabase.txt"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
  if (m) vars[m[1]] = m[2];
}
const url = vars.SUPABASE_URL, key = vars.SUPABASE_SECRET_KEY;
if (!url || !key) { console.error("Need SUPABASE_URL and SUPABASE_SECRET_KEY in passwords/supabase.txt"); process.exit(1); }

const apk = process.argv[2];
if (!apk || !fs.existsSync(apk)) { console.error("Usage: node scripts/publish-release.js <path to .apk> [notes]"); process.exit(1); }
const notes = process.argv[3] || "";
const appJson = JSON.parse(fs.readFileSync(path.join(root, "app", "app.json"), "utf8")).expo;
const version = appJson.version, versionCode = appJson.android?.versionCode ?? 1;

async function upload(name, body, contentType) {
  const r = await fetch(`${url}/storage/v1/object/releases/${name}`, {
    method: "POST", headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": contentType, "x-upsert": "true" }, body,
  });
  if (!r.ok) throw new Error(`${name}: ${r.status} ${(await r.text()).slice(0, 300)}`);
  return `${url}/storage/v1/object/public/releases/${name}`;
}

(async () => {
  const bytes = fs.readFileSync(apk);
  console.log(`uploading ${path.basename(apk)} (${(bytes.length / 1048576).toFixed(0)} MB) as version ${version} / code ${versionCode}…`);
  const latestUrl = await upload("izicost-latest.apk", bytes, "application/vnd.android.package-archive");
  await upload(`izicost-v${version}.apk`, bytes, "application/vnd.android.package-archive");
  const manifest = { version, versionCode, url: latestUrl, size_mb: Math.round(bytes.length / 1048576), notes, published_at: new Date().toISOString() };
  await upload("latest.json", JSON.stringify(manifest, null, 2), "application/json");
  console.log("published:", latestUrl);
  console.log("manifest: ", `${url}/storage/v1/object/public/releases/latest.json`);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
