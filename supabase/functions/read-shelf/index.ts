// IziCost — read-shelf Edge Function (Shelf scan).
// The app uploads photos of supermarket shelf labels to the private "receipts" bucket (own folder),
// then calls this with the paths. We ask Claude to read every price label it can see and return
// structured lines; the app shows them for review and publishes through the save_shelf_scan RPC.
// Only trusted seeders (table trusted_seeders) or everyone when community_settings.shelf_scan_open = '1'.
// The photos are deleted from storage right after they are downloaded: a shelf photo has no
// value once read, and it must never sit in the bucket.
//
// Deploy:  node scripts/deploy-function.js read-shelf

import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-sonnet-5";
const MAX_PHOTOS = 12;

const CATEGORIES: Record<string, string[]> = {
  food: ["vegetables", "fruit", "red_meat", "poultry", "fish_seafood", "dairy_eggs", "bakery_bread",
    "pantry", "breakfast_cereal", "snacks_sweets", "frozen", "baby_food", "other_food"],
  drink: ["water", "soft_drink", "juice", "coffee_tea", "energy_drink"],
  alcohol: ["beer", "wine", "spirits", "cider"],
  household: ["cleaning", "kitchen", "bags_packaging", "home_decor", "garden"],
  personal_care: ["toiletries", "cosmetics"],
  pharmacy: ["medicine", "supplements"],
  pet: ["pet_food", "pet_supplies"],
  clothing: ["clothing", "shoes", "accessories"],
  electronics: ["electronics"],
  other: ["other"],
};
const CATEGORY_TEXT = Object.entries(CATEGORIES).map(([c, s]) => `  ${c}: ${s.join(", ")}`).join("\n");

const SCHEMA = {
  type: "object",
  properties: {
    store_name_seen: { type: ["string", "null"], description: "shop name if printed on any label, else null" },
    currency_seen: { type: ["string", "null"], description: "MZN, ZAR or null" },
    photos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer", description: "0-based photo index" },
          readable: { type: "boolean", description: "false when no price label can be read in this photo" },
          note: { type: "string", description: "empty string, or why it was unreadable (blurry, dark, no labels, ...)" },
        },
        required: ["index", "readable", "note"],
        additionalProperties: false,
      },
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "product name as a receipt would print it, brand included, size included when printed" },
          brand: { type: ["string", "null"] },
          size: { type: ["string", "null"], description: "as printed, e.g. 1L, 500g, 6x330ml" },
          price: { type: "number", description: "the price the shopper pays now (promo price if there is one)" },
          price_per: { type: "string", enum: ["each", "per_kg", "per_l"] },
          promo: { type: "boolean" },
          category: { type: "string", enum: Object.keys(CATEGORIES) },
          subcategory: { type: "string" },
          confidence: { type: "string", enum: ["high", "low"] },
          photo_index: { type: "integer" },
        },
        required: ["name", "brand", "size", "price", "price_per", "promo", "category", "subcategory", "confidence", "photo_index"],
        additionalProperties: false,
      },
    },
  },
  required: ["store_name_seen", "currency_seen", "photos", "items"],
  additionalProperties: false,
};

const SYSTEM = `You read supermarket SHELF PRICE LABELS from photos taken while walking along the shelves,
mainly in Mozambique (Portuguese, prices in MT / MZN, e.g. "MT 1.384,20", "1384,20 MT") and South Africa
(English, prices in R / ZAR). Photos may be tilted, partly blurred or taken from a pocket.

Rules:
- One item per price label you can read with confidence. Never invent a product or a price. If the price
  digits are not clearly readable, leave the label out. If a name is only partly readable, mark confidence "low".
- name: the product exactly as a till receipt would print it, brand included, size included when printed
  (e.g. "Leite UHT Parmalat 1L", "Arroz Tio João 5kg", "Coca-Cola 2L"). brand: the brand alone, or null.
- price: what the shopper pays NOW. When a label shows an old price and a promotion price ("antes / agora",
  "was / now", crossed-out), use the promotion price and set promo = true.
- price_per: "each" for a packaged product; "per_kg" when the label prices by weight (meat, fruit, vegetables,
  cheese at the counter: "MT 899,00 / kg"); "per_l" for liquids sold by the litre. For per_kg / per_l items,
  do NOT put a weight in the name (write "Picanha", not "Picanha 1kg"). Many labels also print a small
  per-kilo or per-litre comparison price next to the pack price: ignore that small print for packaged goods.
- Amounts are plain numbers: "1.384,20" and "1,384.20" both mean 1384.20. Strip currency symbols.
- The same product seen on two photos (overlap) is ONE item: list it once.
- Every item gets category + subcategory from this list (closest match):
${CATEGORY_TEXT}
- photos: one entry per photo, in order; readable = false when nothing usable is in it, with a short note.`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: "not signed in" }, 401);
  const uid = userData.user.id;
  // Guest sessions are free to create, so a per-account cap would not cap: shelf scan needs a real account.
  if (userData.user.is_anonymous) return json({ error: "shelf scan needs an account" }, 403);

  // Who may use it: trusted seeders, or everyone once the setting is switched on.
  const [{ data: seeder }, { data: setting }] = await Promise.all([
    admin.from("trusted_seeders").select("user_id").eq("user_id", uid).maybeSingle(),
    admin.from("community_settings").select("value").eq("key", "shelf_scan_open").maybeSingle(),
  ]);
  if (!seeder && setting?.value !== "1") return json({ error: "shelf scan is not enabled for this account" }, 403);

  let body: { image_paths?: unknown; store_name?: unknown; currency_hint?: unknown };
  try { body = await req.json(); } catch { return json({ error: "bad JSON body" }, 400); }
  const allPaths = Array.isArray(body.image_paths) ? body.image_paths : [];
  if (!allPaths.length) return json({ error: "image_paths required" }, 400);
  if (allPaths.length > MAX_PHOTOS) return json({ error: `at most ${MAX_PHOTOS} photos per read` }, 400);
  for (const p of allPaths) {
    if (typeof p !== "string" || !p.startsWith(`${uid}/`) || p.includes("..")) return json({ error: "image_path must be inside your folder" }, 403);
  }
  const imagePaths = allPaths as string[];
  // Hints are data, not instructions: one line, no quotes, short.
  const storeHint = typeof body.store_name === "string" ? body.store_name.replace(/["'\r\n\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) : "";
  const curHint = body.currency_hint === "ZAR" ? "ZAR" : body.currency_hint === "MZN" ? "MZN" : "";

  // From here on the photos are ours to delete: a shelf photo has no value once read, and must never sit in the bucket.
  // (On any failure the app still has its local copies and simply uploads again on retry.)
  const cleanup = () => admin.storage.from("receipts").remove(imagePaths).then(() => {}, (e) => console.error("cleanup failed", String(e)));

  // Caps: 300 shelf photos per person per day, 1500 shelf photos per day for everyone (≈ US$15). FAIL CLOSED:
  // when the accounting cannot be read or written, no model call is made.
  const PHOTO_CAP = Number(Deno.env.get("DAILY_SHELF_PHOTO_CAP")) || 300;
  const GLOBAL_PHOTO_CAP = Number(Deno.env.get("GLOBAL_DAILY_SHELF_PHOTO_CAP")) || 1500;
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [mine, everyone] = await Promise.all([
    admin.from("scan_events").select("image_count").eq("user_id", uid).eq("kind", "shelf").gte("created_at", since),
    admin.from("scan_events").select("image_count").eq("kind", "shelf").gte("created_at", since),
  ]);
  if (mine.error || everyone.error) { await cleanup(); console.error("cap accounting failed", mine.error?.message, everyone.error?.message); return json({ error: "the reading service is unavailable right now" }, 503); }
  const photosToday = (mine.data ?? []).reduce((s, r) => s + (r.image_count ?? 0), 0);
  const photosGlobal = (everyone.data ?? []).reduce((s, r) => s + (r.image_count ?? 0), 0);
  if (photosToday + imagePaths.length > PHOTO_CAP) { await cleanup(); return json({ error: `daily shelf photo limit reached (${PHOTO_CAP} per day)` }, 429); }
  if (photosGlobal + imagePaths.length > GLOBAL_PHOTO_CAP) { await cleanup(); console.error("GLOBAL shelf cap reached", photosGlobal); return json({ error: "scanning is paused for today, please try again tomorrow" }, 503); }

  const t0 = Date.now();
  // Reserve the photos in the accounting BEFORE calling the model (the row is updated with the outcome afterwards).
  const reserved = await admin.from("scan_events").insert({ user_id: uid, image_count: imagePaths.length, model: MODEL, ok: false, kind: "shelf" }).select("id").single();
  if (reserved.error || !reserved.data) { await cleanup(); console.error("cap reservation failed", reserved.error?.message); return json({ error: "the reading service is unavailable right now" }, 503); }
  const logScan = (ok: boolean, msg?: { usage?: { input_tokens?: number; output_tokens?: number } }) =>
    admin.from("scan_events").update({
      ok, input_tokens: msg?.usage?.input_tokens ?? null, output_tokens: msg?.usage?.output_tokens ?? null, latency_ms: Date.now() - t0,
    }).eq("id", reserved.data.id).then(() => {}, () => {});

  const imageBlocks: unknown[] = [];
  for (const imagePath of imagePaths) {
    const { data: blob, error: dlErr } = await admin.storage.from("receipts").download(imagePath);
    if (dlErr || !blob) { await cleanup(); console.error("photo download failed", imagePath.slice(-24), dlErr?.message); return json({ error: "cannot read one of the photos" }, 404); }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const mediaType = imagePath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    imageBlocks.push({ type: "image", source: { type: "base64", media_type: mediaType, data: btoa(bin) } });
  }

  const hints = [
    storeHint ? `The shop is: ${storeHint}.` : "",
    curHint ? `Prices are in ${curHint}.` : "",
  ].filter(Boolean).join(" ");
  const userText = `${imagePaths.length} photos of shelf labels, taken in order along the shelves. ${hints} Read every price label you can.`.trim();

  try {
  let resp: Response;
  try {
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 12000,
        system: SYSTEM,
        messages: [{ role: "user", content: [...imageBlocks, { type: "text", text: userText }] }],
        output_config: { format: { type: "json_schema", schema: SCHEMA } },
      }),
    });
  } catch (e) {
    await logScan(false);
    console.error("anthropic unreachable", String((e as Error).message ?? e));
    return json({ error: "the reading service is unavailable right now" }, 502);
  }
  if (!resp.ok) {
    const errText = await resp.text();
    await logScan(false);
    console.error("anthropic error", resp.status, errText.slice(0, 500));
    return json({ error: `the reading service returned an error (${resp.status})` }, 502);
  }
  const msg = await resp.json();
  await logScan(true, msg);
  if (msg.stop_reason === "refusal") return json({ error: "model declined these photos" }, 422);
  if (msg.stop_reason === "max_tokens") return json({ error: "too many labels for one read; try fewer photos" }, 422);
  const text = (msg.content ?? []).find((b: { type: string }) => b.type === "text")?.text ?? "";
  let parsed: { items?: unknown[] };
  try { parsed = JSON.parse(text); } catch { return json({ error: "model returned invalid JSON" }, 502); }

  return json({ result: parsed, model: MODEL, latency_ms: Date.now() - t0,
    usage: { input_tokens: msg.usage?.input_tokens, output_tokens: msg.usage?.output_tokens } });
  } finally {
    await cleanup(); // read or not, the photos never stay in the bucket
  }
});
