// Demo prices for ONE account's open basket lines, so "Where is it cheapest?" can be seen with complete baskets
// at several shops (PS, 2026-09-05). Creates the products the lines name (if missing) and gives three seed
// branches (Shoprite Costa do Sol, Spar Sommerschield, Recheio Maputo) a price for each, over the last 3 weeks.
//   node scripts/seed-basket-demo.js <user id or prefix>
// Price points sit on seed stores (tax ids 4000990xx), so `node scripts/seed-demo.js clean` removes them too.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const vars = {};
for (const line of fs.readFileSync(path.join(root, "passwords", "supabase.txt"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
  if (m) vars[m[1]] = m[2];
}
const ref = (vars.SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!vars.SUPABASE_ACCESS_TOKEN || !ref) { console.error("Need SUPABASE_ACCESS_TOKEN and SUPABASE_URL in passwords/supabase.txt"); process.exit(1); }
async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    // names read back from the database go through q(); the quoting is only sound with standard_conforming_strings on
    method: "POST", headers: { Authorization: `Bearer ${vars.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: `set standard_conforming_strings = on;
${query}` }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`SQL ${r.status}: ${text.slice(0, 400)}`);
  try { return JSON.parse(text); } catch { return []; }
}
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
let seed = 20260905;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const round2 = (n) => Math.round(n * 100) / 100;

// a plausible Maputo price for a line we have never seen, from a few keywords (MZN)
function guessPrice(name) {
  const n = name.toLowerCase();
  const table = [
    [/whisky|whiskey/, 2200], [/vinho|cabernet|merlot|sauvignon|shiraz/, 650], [/cerveja/, 95], [/azeite/, 950], [/óleo|oleo/, 380],
    [/água|agua/, 45], [/tónica|tonica/, 70], [/leite/, 95], [/carne|picanha|bife/, 480], [/lata/, 160], [/arroz/, 520],
    [/açúcar|acucar/, 90], [/sal /, 35], [/cebola|tomate|batata|lima|limão|limao/, 110], [/pão|pao/, 60], [/café|cafe/, 480],
    [/ovos/, 150], [/queijo|manteiga|iogurte/, 260], [/sabão|sabao|omo|detergente/, 320], [/papel/, 300],
  ];
  const base = table.find(([re]) => re.test(n))?.[1] ?? 150;
  const size = n.match(/(\d+(?:[.,]\d+)?)\s?(kg|l)\b/);
  return round2(base * (size ? Math.max(1, Number(size[1].replace(",", ".")) * 0.8) : 1));
}

(async () => {
  const prefix = (process.argv[2] || "").toLowerCase();
  if (!prefix) { console.error("Usage: node scripts/seed-basket-demo.js <user id or prefix>"); process.exit(1); }
  const users = await sql(`select id from auth.users where id::text like ${q(prefix + "%")}`);
  if (users.length !== 1) throw new Error(`expected exactly one account for ${prefix}, found ${users.length}`);
  const uid = users[0].id;
  const items = await sql(`select distinct i.name from public.shopping_list_items i join public.shopping_lists l on l.id = i.list_id where l.user_id = ${q(uid)} and not i.checked`);
  if (!items.length) { console.log("no open basket lines"); return; }
  const stores = await sql(`select id, name, tax_id from public.stores where tax_id in ('40009901','40009902','40009904') order by tax_id`);
  if (stores.length < 3) throw new Error("seed stores missing: run 'node scripts/seed-demo.js' first");
  const done = await sql(`select 1 from public.seed_log where kind = 'basket_demo' and ref = ${q(uid)}`);
  if (done.length) { console.log("this account already has its basket demo (run 'node scripts/seed-demo.js clean' to start over)"); return; }
  const mult = { "40009901": 1.0, "40009902": 1.06, "40009904": 0.94 };

  let pts = 0;
  for (const it of items) {
    // products created here are remembered in seed_log so `seed-demo.js clean` removes them again (a basket line is
    // private text; it must not stay in the shared catalogue after the demo). No category guess: null is honest.
    const before = await sql(`select id from public.products where product_key = public.product_key_clean(${q(it.name)})`);
    const rows = await sql(`select public.upsert_product(${q(it.name)}, null, null) as id`);
    const pid = rows[0]?.id; if (!pid) continue;
    if (!before.length) await sql(`insert into public.seed_log (kind, ref) values ('product', ${q(pid)})`);
    const base = guessPrice(it.name);
    const values = [];
    for (let day = 21; day >= 0; day -= 3) {
      for (const s of stores) {
        const price = round2(base * mult[s.tax_id] * (0.97 + rnd() * 0.06));
        values.push(`(${q(pid)}, ${q(s.id)}, 'MZ', 'Maputo', ${price}, null, 'MZN', current_date - ${day}, 'receipt', (current_date - ${day})::timestamptz + interval '12 hours')`);
      }
    }
    await sql(`insert into public.price_points (product_id, store_id, country, city, price, unit_price, currency, observed_on, source, created_at) values ${values.join(",\n")}`);
    pts += values.length;
  }
  await sql(`insert into public.seed_log (kind, ref) values ('basket_demo', ${q(uid)})`);
  console.log(`basket demo: ${items.length} lines × 3 shops, ${pts} price points (Maputo, MZN) for ${uid.slice(0, 8)}…`);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
