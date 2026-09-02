// End-to-end backend check: guest sign-in -> upload a Phase 0 photo -> call extract-receipt.
//   node scripts/test-backend.js [receipt file name]
const fs = require("fs");
const path = require("path");
const { createClient } = require(path.join(__dirname, "..", "app", "node_modules", "@supabase", "supabase-js"));

const root = path.resolve(__dirname, "..");
const env = {};
for (const line of fs.readFileSync(path.join(root, "app", ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
  if (m) env[m[1]] = m[2];
}
const file = process.argv[2] || "r10_Shoprite_CostaDoSol.jpeg";

(async () => {
  const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const { data: auth, error: authErr } = await supabase.auth.signInAnonymously();
  if (authErr) throw authErr;
  const uid = auth.user.id;
  console.log("guest user:", uid);

  const bytes = fs.readFileSync(path.join(root, "phase0", "receipts", file));
  const imagePath = `${uid}/${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage.from("receipts").upload(imagePath, bytes, { contentType: "image/jpeg" });
  if (upErr) throw upErr;
  console.log("uploaded:", imagePath, `(${(bytes.length / 1024).toFixed(0)} KB)`);

  const t0 = Date.now();
  const { data, error } = await supabase.functions.invoke("extract-receipt", { body: { image_path: imagePath } });
  if (error) {
    let detail = error.message;
    try { detail = JSON.stringify(await error.context.json()); } catch {}
    throw new Error("function error: " + detail);
  }
  const x = data.extraction;
  console.log(`function ok in ${((Date.now() - t0) / 1000).toFixed(1)}s (model ${data.model}, ${data.latency_ms} ms inside, tokens in/out ${data.usage.input_tokens}/${data.usage.output_tokens})`);
  console.log(`store: ${x.store_name} | ${x.store_type} | ${x.store_branch_address}`);
  console.log(`date: ${x.date} ${x.time} | total: ${x.total} ${x.currency} | paid: ${x.payment_method} | NUIT: ${x.store_tax_id}`);
  for (const it of x.items) console.log(`  ${it.qty} x ${it.name} = ${it.line_total} [${it.category}/${it.subcategory}] ${it.confidence === "low" ? "(low confidence)" : ""}`);

  // clean up the test upload
  await supabase.storage.from("receipts").remove([imagePath]);
  console.log("cleaned up test photo");
})().catch((e) => { console.error("FAILED:", e.message || e); process.exit(1); });
