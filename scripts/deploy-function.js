// Publishes the extract-receipt Edge Function and its secret to the Supabase project.
//   node scripts/deploy-function.js
// Reads SUPABASE_ACCESS_TOKEN + SUPABASE_URL from passwords/supabase.txt and the Anthropic key
// from phase0/key1.txt (or ANTHROPIC_API_KEY=... in passwords/supabase.txt). Prints status only.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const vars = {};
for (const line of fs.readFileSync(path.join(root, "passwords", "supabase.txt"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
  if (m) vars[m[1]] = m[2];
}
const token = vars.SUPABASE_ACCESS_TOKEN;
const ref = (vars.SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!token || !ref) { console.error("Need SUPABASE_ACCESS_TOKEN and SUPABASE_URL in passwords/supabase.txt"); process.exit(1); }

let anthropic = vars.ANTHROPIC_API_KEY;
if (!anthropic) {
  for (const f of ["phase0/key1.txt", "phase0/.env"]) {
    const p = path.join(root, f);
    if (fs.existsSync(p)) { const m = fs.readFileSync(p, "utf8").match(/sk-ant-[A-Za-z0-9_\-]+/); if (m) { anthropic = m[0]; break; } }
  }
}
if (!anthropic) { console.error("No Anthropic key found (phase0/key1.txt)"); process.exit(1); }

const env = { ...process.env, SUPABASE_ACCESS_TOKEN: token };
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
function run(args) {
  console.log("> supabase " + args.filter((a) => !a.startsWith("ANTHROPIC")).join(" "));
  const r = spawnSync(npx, ["--yes", "supabase@latest", ...args], { cwd: root, env, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) { console.error("FAILED (exit " + r.status + ")"); process.exit(r.status || 1); }
}

// 1) secret, via a temp env file so the key never appears on a command line
const tmp = path.join(os.tmpdir(), "izicost-edge-" + Date.now() + ".env");
fs.writeFileSync(tmp, "ANTHROPIC_API_KEY=" + anthropic + "\n");
try {
  run(["secrets", "set", "--project-ref", ref, "--env-file", tmp]);
} finally {
  fs.unlinkSync(tmp);
}
// 2) the function itself (verify_jwt comes from supabase/config.toml)
run(["functions", "deploy", "extract-receipt", "--project-ref", ref]);
console.log("deploy: done");
