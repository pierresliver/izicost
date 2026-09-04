// Demo data for testing how the app FEELS with three months of activity (PS, 2026-09-04).
//   node scripts/seed-demo.js          -> seed: fake branches + ~2500 community price points over 90 days in
//                                         Maputo/Matola/Beira/Nampula, and ~30 receipts per test account
//   node scripts/seed-demo.js clean    -> remove everything the seed created (nothing else)
// Everything is flagged: seed stores carry tax ids 4000990xx, seed receipts have notes = 'SEED', and only
// products that did not exist before are recorded for deletion. Uses the management API (postgres role),
// so RLS does not apply; triggers still run (receipt lines -> price points).
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
    method: "POST", headers: { Authorization: "Bearer " + vars.SUPABASE_ACCESS_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`SQL ${r.status}: ${text.slice(0, 500)}`);
  try { return JSON.parse(text); } catch { return []; }
}
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

// deterministic pseudo-random so a re-seed looks the same
let seed = 20260904;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const round2 = (n) => Math.round(n * 100) / 100;
const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - n); return d; };

// ── the fake world ────────────────────────────────────────────────────────────────────────────
const STORES = [
  { name: "Shoprite", branch: "Av. da Marginal 9519, Costa do Sol", city: "Maputo", mult: 1.00, tax: "40009901", lat: -25.9225, lng: 32.6045 },
  { name: "Spar", branch: "Av. Julius Nyerere, Sommerschield", city: "Maputo", mult: 1.05, tax: "40009902", lat: -25.953, lng: 32.596 },
  { name: "Premier Superspar", branch: "Av. 24 de Julho, Polana", city: "Maputo", mult: 1.03, tax: "40009903", lat: -25.966, lng: 32.59 },
  { name: "Recheio", branch: "Av. de Angola, Maputo", city: "Maputo", mult: 0.93, tax: "40009904", lat: -25.933, lng: 32.58 },
  { name: "Lokal", branch: "Rua da Resistência, Maputo", city: "Maputo", mult: 1.08, tax: "40009905", lat: -25.96, lng: 32.585 },
  { name: "Woolworths", branch: "Maputo Shopping, Av. da Marginal", city: "Maputo", mult: 1.25, tax: "40009906", lat: -25.97, lng: 32.594 },
  { name: "Shoprite", branch: "Av. da Namaacha, Matola", city: "Matola", mult: 0.99, tax: "40009907", lat: -25.962, lng: 32.458 },
  { name: "Spar", branch: "Matola Shopping", city: "Matola", mult: 1.04, tax: "40009908", lat: -25.966, lng: 32.47 },
  { name: "Shoprite", branch: "Av. Eduardo Mondlane, Beira", city: "Beira", mult: 1.04, tax: "40009909", lat: -19.833, lng: 34.848 },
  { name: "Spar", branch: "Rua Major Serpa Pinto, Beira", city: "Beira", mult: 1.09, tax: "40009910", lat: -19.843, lng: 34.838 },
  { name: "Shoprite", branch: "Av. do Trabalho, Nampula", city: "Nampula", mult: 1.09, tax: "40009911", lat: -15.117, lng: 39.266 },
  { name: "Recheio", branch: "Av. Eduardo Mondlane, Nampula", city: "Nampula", mult: 1.02, tax: "40009912", lat: -15.12, lng: 39.26 },
];
// name as printed, clean product name, category, subcategory, base price (MZN), monthly drift, by weight?
const PRODUCTS = [
  ["ARROZ TIO JOAO 5KG", "Arroz Tio João 5kg", "food", "pantry", 550, 0.012],
  ["OLEO FULA 1L", "Óleo Fula 1L", "food", "pantry", 180, 0.015],
  ["LEITE UHT PARMALAT 1L", "Leite UHT Parmalat 1L", "food", "dairy_eggs", 95, 0.010],
  ["OVOS DUZIA", "Ovos dúzia", "food", "dairy_eggs", 150, 0.020],
  ["ACUCAR 1KG", "Açúcar 1kg", "food", "pantry", 90, 0.008],
  ["FARINHA TRIGO 1KG", "Farinha de trigo 1kg", "food", "pantry", 85, 0.012],
  ["PAO FORMA", "Pão de forma", "food", "bakery_bread", 75, 0.010],
  ["FRANGO INTEIRO KG", "Frango inteiro kg", "food", "poultry", 320, 0.025, true],
  ["PICANHA KG", "Picanha kg", "food", "red_meat", 1250, 0.030, true],
  ["FILETE BOVINO KG", "Filete bovino kg", "food", "red_meat", 1650, 0.032, true],
  ["ALCATRA KG", "Alcatra kg", "food", "red_meat", 950, 0.028, true],
  ["VINHO CASILLERO DEL DIABLO 750ML", "Vinho Casillero del Diablo 750ml", "alcohol", "wine", 780, 0.018],
  ["WHISKY JAMESON 750ML", "Whisky Jameson 750ml", "alcohol", "spirits", 2200, 0.020],
  ["CERVEJA 2M 550ML", "Cerveja 2M 550ml", "alcohol", "beer", 95, 0.010],
  ["COCA COLA 2L", "Coca-Cola 2L", "drink", "soft_drink", 120, 0.008],
  ["AGUA VUMBA 5L", "Água Vumba 5L", "drink", "water", 110, 0.005],
  ["TOMATE KG", "Tomate kg", "food", "vegetables", 120, 0.035, true],
  ["CEBOLA KG", "Cebola kg", "food", "vegetables", 90, -0.010, true],
  ["BATATA KG", "Batata kg", "food", "vegetables", 95, 0.015, true],
  ["OMO 2KG", "OMO 2kg", "household", "cleaning", 650, 0.010],
  ["PAPEL HIGIENICO 9 ROLOS", "Papel higiénico 9 rolos", "household", "cleaning", 320, 0.012],
  ["WHISKAS 1KG", "Whiskas 1kg", "pet", "pet_food", 480, 0.010],
  ["CAFE NESCAFE 200G", "Café Nescafé 200g", "drink", "coffee_tea", 520, 0.014],
  ["MANTEIGA 500G", "Manteiga 500g", "food", "dairy_eggs", 310, 0.022],
  ["QUEIJO FLAMENGO 250G", "Queijo flamengo 250g", "food", "dairy_eggs", 260, 0.018],
  ["IOGURTE 4X125G", "Iogurte 4x125g", "food", "dairy_eggs", 180, 0.010],
  ["ATUM LATA 170G", "Atum lata 170g", "food", "pantry", 95, 0.010],
  ["MASSA ESPARGUETE 500G", "Massa esparguete 500g", "food", "pantry", 75, 0.008],
  ["FEIJAO MANTEIGA 1KG", "Feijão manteiga 1kg", "food", "pantry", 160, 0.012],
  ["SABONETE LUX", "Sabonete Lux", "personal_care", "toiletries", 45, 0.006],
];
const USUAL = [0, 1, 2, 3, 6, 7, 8, 11, 12, 13, 14, 16, 17, 21]; // what "our" test accounts buy over and over
const DAYS = 90;

/** Price of product p at store s on a given day: base × store × drift × weekly promo × noise. */
function price(p, s, day) {
  const monthsAgo = day / 30;
  const drift = Math.pow(1 + p[5], (DAYS / 30) - monthsAgo); // rises towards today
  const week = Math.floor(day / 7);
  const promo = ((s.tax.slice(-2) * 31 + week * 7 + PRODUCTS.indexOf(p) * 13) % 100) < 9 ? 0.85 : 1; // ~9% of store-weeks on promo
  const noise = 0.98 + rnd() * 0.04;
  return round2(p[4] * s.mult * drift * promo * noise);
}

async function seedAll() {
  const t0 = new Date().toISOString();
  await sql(`create table if not exists public.seed_log (kind text not null, ref text not null, created_at timestamptz not null default now());
             alter table public.seed_log enable row level security; revoke all on public.seed_log from anon, authenticated;`);
  const already = await sql(`select count(*)::int as n from public.seed_log where kind = 'store'`);
  if (already[0]?.n) { console.log("Seed data already present. Run 'node scripts/seed-demo.js clean' first."); process.exit(1); }

  // stores
  const storeRows = STORES.map((s) => `(${q(s.name)}, ${q(s.name.toLowerCase())}, ${q(s.branch)}, ${q(s.tax)}, 'supermarket', 'MZ', ${q(s.city)}, ${s.lat}, ${s.lng})`).join(",\n");
  const stores = await sql(`insert into public.stores (name, name_key, branch_address, tax_id, store_type, country, city, lat, lng) values ${storeRows} returning id, tax_id`);
  for (const s of STORES) s.id = stores.find((r) => r.tax_id === s.tax).id;
  await sql(`insert into public.seed_log (kind, ref) values ${STORES.map((s) => `('store', ${q(s.id)})`).join(",")}`);

  // products (remember only the ones that did not exist)
  const before = await sql(`select id from public.products`);
  const beforeIds = new Set(before.map((r) => r.id));
  const prodRows = await sql(`select v.n as name, public.upsert_product(v.n, v.c, v.s) as id from (values ${PRODUCTS.map((p) => `(${q(p[1])}, ${q(p[2])}, ${q(p[3])})`).join(",")}) v(n, c, s)`);
  for (const p of PRODUCTS) p.id = prodRows.find((r) => r.name === p[1]).id;
  const newProducts = PRODUCTS.filter((p) => !beforeIds.has(p.id));
  if (newProducts.length) await sql(`insert into public.seed_log (kind, ref) values ${newProducts.map((p) => `('product', ${q(p.id)})`).join(",")}`);

  // community price points: every store reports ~40% of the catalogue every 3rd day
  const pts = [];
  for (let day = DAYS; day >= 0; day--) {
    for (const s of STORES) {
      if ((day + STORES.indexOf(s)) % 3 !== 0) continue;
      for (const p of PRODUCTS) {
        if (rnd() > 0.4) continue;
        const pr = price(p, s, day);
        const unit = p[6] ? pr : (p[1].match(/(\d+(?:[.,]\d+)?)\s?(kg|g|l|ml)\b/i) ? null : null);
        pts.push(`(${q(p.id)}, ${q(s.id)}, 'MZ', ${q(s.city)}, ${pr}, ${unit ?? "null"}, 'MZN', ${q(iso(daysAgo(day)))}, 'receipt', ${q(new Date(daysAgo(day).getTime() + 12 * 3600e3).toISOString())})`);
      }
    }
  }
  for (let i = 0; i < pts.length; i += 400) {
    await sql(`insert into public.price_points (product_id, store_id, country, city, price, unit_price, currency, observed_on, source, created_at) values ${pts.slice(i, i + 400).join(",\n")}`);
  }
  console.log(`community: ${STORES.length} branches, ${PRODUCTS.length} products, ${pts.length} price points over ${DAYS} days`);

  // personal receipts for every test account (everything except the old guest that holds real receipts)
  const users = await sql(`select id from auth.users u where not exists (select 1 from public.receipts r where r.user_id = u.id and coalesce(r.notes,'') <> 'SEED') order by created_at`);
  let receipts = 0;
  for (const u of users) {
    const fav = [STORES[0], STORES[pick([1, 2, 3, 4, 6])]]; // two favourite Maputo/Matola branches
    const stmts = [];
    for (let day = DAYS; day >= 0; day -= 3 + Math.floor(rnd() * 3)) {          // a shop every 3–5 days
      const s = rnd() < 0.7 ? fav[0] : fav[1];
      const idx = new Set(USUAL.filter(() => rnd() < 0.6));
      while (idx.size < 6) idx.add(Math.floor(rnd() * PRODUCTS.length));
      const lines = [...idx].map((i, n) => {
        const p = PRODUCTS[i];
        const unit = price(p, s, day);
        const qty = p[6] ? round2(0.6 + rnd() * 1.2) : (rnd() < 0.2 ? 2 : 1);
        return { n: n + 1, p, qty, unit, total: round2(unit * qty) };
      });
      const total = round2(lines.reduce((a, l) => a + l.total, 0));
      const when = iso(daysAgo(day));
      stmts.push(`with r as (insert into public.receipts (user_id, store_id, store_name, store_branch_address, store_tax_id, store_type, doc_type, country, currency, purchased_on, purchased_at_time, subtotal, tax_total, discount_total, total, payment_method, legibility, notes, model, confirmed, created_at)
        values (${q(u.id)}, ${q(s.id)}, ${q(s.name)}, ${q(s.branch)}, ${q(s.tax)}, 'supermarket', 'itemized_receipt', 'MZ', 'MZN', ${q(when)}, ${q(`${10 + Math.floor(rnd() * 9)}:${String(Math.floor(rnd() * 60)).padStart(2, "0")}`)}, ${total}, ${round2(total * 0.16 / 1.16)}, 0, ${total}, ${q(pick(["card", "cash", "mobile_money"]))}, 'good', 'SEED', 'seed', true, ${q(new Date(daysAgo(day).getTime() + 15 * 3600e3).toISOString())}) returning id)
        insert into public.receipt_items (receipt_id, user_id, line_no, name_as_printed, product_name, qty, unit_price, line_total, category, subcategory, created_at)
        select r.id, ${q(u.id)}, v.n, v.a, v.b, v.qty, v.u, v.t, v.c, v.s, ${q(new Date(daysAgo(day).getTime() + 15 * 3600e3).toISOString())} from r, (values ${lines.map((l) => `(${l.n}, ${q(l.p[0])}, ${q(l.p[1])}, ${l.qty}, ${l.unit}, ${l.total}, ${q(l.p[2])}, ${q(l.p[3])})`).join(",")}) v(n, a, b, qty, u, t, c, s)`);
      receipts++;
    }
    // a few restaurant and parking receipts for variety in the category ring
    for (const [day, name, type, items] of [
      [8, "Complexo Piripiri", "restaurant", [["FRANGO PIRIPIRI", "restaurant", "meal", 650], ["CERVEJA 2M", "restaurant", "alcohol", 120], ["CERVEJA 2M", "restaurant", "alcohol", 120]]],
      [22, "Café Sol", "bar_cafe", [["CAPPUCCINO", "restaurant", "coffee", 180], ["BOLO CENOURA", "restaurant", "dessert", 220]]],
      [40, "Estacionamento Baía", "parking", [["ESTACIONAMENTO", "parking", "parking", 50]]],
    ]) {
      const total = items.reduce((a, it) => a + it[3], 0);
      stmts.push(`with r as (insert into public.receipts (user_id, store_name, store_type, doc_type, country, currency, purchased_on, total, payment_method, legibility, notes, model, confirmed, created_at)
        values (${q(u.id)}, ${q(name)}, ${q(type)}, 'itemized_receipt', 'MZ', 'MZN', ${q(iso(daysAgo(day)))}, ${total}, 'card', 'good', 'SEED', 'seed', true, ${q(new Date(daysAgo(day).getTime() + 19 * 3600e3).toISOString())}) returning id)
        insert into public.receipt_items (receipt_id, user_id, line_no, name_as_printed, product_name, qty, unit_price, line_total, category, subcategory)
        select r.id, ${q(u.id)}, v.n, v.a, v.a, 1, v.t, v.t, v.c, v.s from r, (values ${items.map((it, n) => `(${n + 1}, ${q(it[0])}, ${it[3]}, ${q(it[1])}, ${q(it[2])})`).join(",")}) v(n, a, t, c, s)`);
      receipts++;
    }
    for (let i = 0; i < stmts.length; i += 15) await sql(stmts.slice(i, i + 15).join(";\n"));
  }
  await sql(`insert into public.seed_log (kind, ref) values ('window', ${q(t0)})`);
  console.log(`personal: ${receipts} receipts across ${users.length} accounts (notes = 'SEED')`);

  const check = await sql(`select (select count(*) from public.community_prices) as community_prices, (select count(*) from public.city_price_index(6)) as city_index_rows, (select count(*) from public.receipts where notes='SEED') as seed_receipts`);
  console.log("check:", JSON.stringify(check[0]));
}

async function cleanAll() {
  const n = await sql(`
    with s as (select ref::uuid as id from public.seed_log where kind = 'store'),
         d1 as (delete from public.receipts where notes = 'SEED' returning id),
         d2 as (delete from public.price_points where store_id in (select id from s) returning id),
         d3 as (delete from public.watch_items where product_id in (select ref::uuid from public.seed_log where kind = 'product') returning id),
         d4 as (delete from public.stores where id in (select id from s) returning id)
    select (select count(*) from d1) receipts, (select count(*) from d2) price_points, (select count(*) from d3) watch_items,
           (select count(*) from d4) stores`);
  // products go in a second statement: inside one statement every CTE sees the same snapshot, so the
  // "no price points left" check would still see the rows d2 just deleted
  const p = await sql(`
    with d5 as (delete from public.products p where p.id in (select ref::uuid from public.seed_log where kind = 'product')
                  and not exists (select 1 from public.price_points pp where pp.product_id = p.id) returning id),
         d6 as (delete from public.seed_log returning kind)
    select (select count(*) from d5) products`);
  console.log("removed:", JSON.stringify({ ...n[0], ...p[0] }));
}

(async () => {
  try {
    if (process.argv[2] === "clean") await cleanAll(); else await seedAll();
  } catch (e) { console.error("FAILED:", e.message); process.exit(1); }
})();
