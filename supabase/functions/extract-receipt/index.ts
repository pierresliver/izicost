// IziCost — extract-receipt Edge Function.
// The app uploads a photo to the private "receipts" bucket, then calls this function with the
// path. This function (which holds the Anthropic key — the app never does) downloads the photo,
// asks Claude Sonnet 5 for a structured reading, and returns the JSON.
//
// Deploy:  supabase functions deploy extract-receipt
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-sonnet-5";

const STORE_TYPES = ["supermarket", "convenience_store", "restaurant", "bar_cafe", "fuel_station",
  "pharmacy", "parking", "utility_provider", "clothing_store", "market_informal", "other"];

const CATEGORIES: Record<string, string[]> = {
  food: ["vegetables", "fruit", "red_meat", "poultry", "fish_seafood", "dairy_eggs", "bakery_bread",
    "pantry", "breakfast_cereal", "snacks_sweets", "frozen", "baby_food", "other_food"],
  drink: ["water", "soft_drink", "juice", "coffee_tea", "energy_drink"],
  alcohol: ["beer", "wine", "spirits", "cider"],
  restaurant: ["meal", "starter_snack", "dessert", "drink", "alcohol", "coffee"],
  household: ["cleaning", "kitchen", "bags_packaging", "home_decor", "garden"],
  personal_care: ["toiletries", "cosmetics"],
  pharmacy: ["medicine", "supplements"],
  pet: ["pet_food", "pet_supplies"],
  clothing: ["clothing", "shoes", "accessories"],
  electronics: ["electronics"],
  fuel: ["fuel"],
  parking: ["parking"],
  transport: ["transport"],
  utilities: ["tv", "internet", "electricity", "water", "phone"],
  services: ["services"],
  other: ["other"],
};
const CATEGORY_TEXT = Object.entries(CATEGORIES).map(([c, s]) => `  ${c}: ${s.join(", ")}`).join("\n");

const NUM_OR_NULL = { type: ["number", "null"] };
const STR_OR_NULL = { type: ["string", "null"] };

const SCHEMA = {
  type: "object",
  properties: {
    doc_type: { type: "string", enum: ["itemized_receipt", "card_slip", "handwritten", "invoice", "bar_tab", "other"] },
    store_type: { type: "string", enum: STORE_TYPES },
    country: { type: "string", description: "ISO code like MZ or ZA, or empty string if unknown" },
    currency: { type: "string", description: "ISO code like MZN or ZAR, or empty string if unknown" },
    store_name: STR_OR_NULL,
    store_branch_address: STR_OR_NULL,
    store_tax_id: STR_OR_NULL,
    receipt_number: STR_OR_NULL,
    date: STR_OR_NULL,
    time: STR_OR_NULL,
    payment_method: STR_OR_NULL,
    subtotal: NUM_OR_NULL,
    tax_total: NUM_OR_NULL,
    discount_total: { type: "number", description: "0 if no discount shown" },
    total: NUM_OR_NULL,
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          qty: NUM_OR_NULL,
          unit_price: NUM_OR_NULL,
          line_total: NUM_OR_NULL,
          category: { type: "string", enum: Object.keys(CATEGORIES) },
          subcategory: { type: "string" },
          confidence: { type: "string", enum: ["high", "low"] },
        },
        required: ["name", "qty", "unit_price", "line_total", "category", "subcategory", "confidence"],
        additionalProperties: false,
      },
    },
    legibility: { type: "string", enum: ["good", "partial", "poor"] },
    notes: { type: "string", description: "empty string if nothing to note" },
  },
  required: ["doc_type", "store_type", "country", "currency", "store_name", "store_branch_address",
    "store_tax_id", "receipt_number", "date", "time", "payment_method", "subtotal", "tax_total",
    "discount_total", "total", "items", "legibility", "notes"],
  additionalProperties: false,
};

const SYSTEM = `You extract structured data from photos of shopping receipts, bills and invoices.
Receipts come mainly from Mozambique (Portuguese, currency MZN / MT / MZM, tax id = NUIT, tax = IVA)
and South Africa (English, currency ZAR / R, tax id = VAT reg no).

Rules:
- Read only what is printed or handwritten on the paper. Never invent a value: if a field is
  not present or not readable, return null. A blank "Valor" line means total = null.
- date -> "YYYY-MM-DD". time -> "HH:MM" (24h). Dates like "28/08/26" mean 2026-08-28.
- Amounts are plain numbers. "1.384,20" and "1,384.20" both mean 1384.20. Strip currency symbols.
- store_name = the trading name (e.g. "Shoprite", "Woolworths"), not the legal company name.
- store_type = what kind of place issued it (supermarket, restaurant, bar_cafe, parking, ...).
- store_branch_address = the full street address of THIS branch as printed anywhere on the
  receipt (header or footer), including the city if printed. Do not invent a city.
- store_tax_id = the STORE's NUIT or VAT number, digits only. Never the customer's tax id.
- items = one entry per purchased product line. Do NOT include discount lines, subtotals,
  tax lines, headers, category labels or payment lines as items.
  name = the item text exactly as printed (keep abbreviations).
  qty = quantity (weights like 0,720 kg are qty 0.72). unit_price = printed unit price, or
  line_total / qty when only the line total is printed, or null if it cannot be determined.
  confidence = "low" when the line is faint, garbled, or you had to guess any number on it.
- Every item gets a category AND a subcategory from this list (use the closest one):
${CATEGORY_TEXT}
  At a restaurant, bar or cafe, every line uses category "restaurant" with subcategory
  meal / starter_snack / dessert / drink / alcohol / coffee. Beer, wine and spirits bought in a
  shop use category "alcohol". Bread from a supermarket is food/bakery_bread; a plastic bag is
  household/bags_packaging; cat food is pet/pet_food.
- Parking tickets, tolls and other single-amount service receipts: create ONE item line
  (e.g. "Estacionamento", qty 1, unit_price = line_total = the amount, category parking).
  If the amount is blank, the item has null prices.
- payment_method: one of "cash", "card", "mobile_money", "other", or null if not shown.
  Labels like "Ned", "POS", "EFT", "Visa", "Nedbank", "BIM" mean card; "M-Pesa", "Emola",
  "mKesh" mean mobile_money.
- A card-terminal slip (no products, just an amount) is doc_type "card_slip" with items = [].
- legibility: your honest read of how readable the photo was.
- notes: anything odd (garbled quantity, stamp over text, stapled slip, etc.), 1 sentence max.`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

  // Who is calling? Validate the caller's JWT with the service-role client (no dependency on legacy keys).
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: "not signed in" }, 401);
  const uid = userData.user.id;

  let body: { image_path?: string };
  try { body = await req.json(); } catch { return json({ error: "bad JSON body" }, 400); }
  const imagePath = body.image_path ?? "";
  if (!imagePath.startsWith(`${uid}/`) || imagePath.includes("..")) return json({ error: "image_path must be inside your folder" }, 403);

  // Download the photo with the service role (bucket is private).
  const { data: blob, error: dlErr } = await admin.storage.from("receipts").download(imagePath);
  if (dlErr || !blob) return json({ error: `cannot read photo: ${dlErr?.message}` }, 404);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const b64 = btoa(bin);
  const mediaType = imagePath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

  const t0 = Date.now();
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } },
          { type: "text", text: "Extract this receipt." },
        ],
      }],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    return json({ error: `model error ${resp.status}: ${errText.slice(0, 300)}` }, 502);
  }
  const msg = await resp.json();
  if (msg.stop_reason === "refusal") return json({ error: "model declined this image" }, 422);
  if (msg.stop_reason === "max_tokens") return json({ error: "receipt too long for one read" }, 422);
  const text = (msg.content ?? []).find((b: { type: string }) => b.type === "text")?.text ?? "";
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return json({ error: "model returned invalid JSON" }, 502); }

  return json({
    extraction: parsed,
    model: MODEL,
    latency_ms: Date.now() - t0,
    usage: { input_tokens: msg.usage?.input_tokens, output_tokens: msg.usage?.output_tokens },
  });
});
