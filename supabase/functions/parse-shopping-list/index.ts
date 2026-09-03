// IziCost — parse-shopping-list Edge Function.
// Turns a spoken (or typed) shopping list such as "dois quilos de arroz, leite, uma dúzia de ovos"
// into structured items: [{ name, qty, size }]. The app matches them to the product catalogue.
// Same security shape as extract-receipt: the Anthropic key lives only here, the caller's JWT is
// verified, and a per-user daily cap (assist_events) protects the bill.
//
// Deploy:  node scripts/deploy-function.js parse-shopping-list

import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-sonnet-5"; // project decision (MASTER_PLAN §12): Sonnet 5 for every extraction task
const MAX_CHARS = 1000;
const KIND = "parse_list";

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "the product, in the language spoken, without quantities" },
          qty: { type: "number", description: "how many units or packs; 1 when not said" },
          size: { type: ["string", "null"], description: "pack size like 5kg, 1L, 500g, 6 un; null when not said" },
        },
        required: ["name", "qty", "size"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

const SYSTEM = `You turn a shopping list that someone said out loud (or typed quickly) into structured items.
The text is usually Portuguese from Mozambique or English from South Africa, sometimes mixed.
It comes from a speech recogniser, so words may be misheard: choose the most likely grocery product.

Rules:
- One item per product mentioned. Keep the order spoken.
- name: the product as people write it on a shopping list, in the language it was said, in its natural
  form ("arroz", "leite", "ovos", "óleo de cozinha", "coca-cola", "bread", "chicken"). Never put
  quantities, sizes or brands-as-sizes in the name. Fix obvious recogniser mistakes.
- qty: the number of units or packs. "três pães" = 3; "duas garrafas de óleo de 1 litro" = 2 with
  size "1L"; "meia dúzia de ovos" = 6 with size null; "uma dúzia de ovos" = 12. When nothing is said, 1.
- size: a pack size when one is spoken: "5kg", "1kg", "500g", "2L", "1L", "330ml", "6 un".
  Weights and volumes are sizes, not quantities: "dois quilos de arroz" = qty 1, size "2kg"
  (unless packs are counted explicitly). Use kg/g/L/ml with no space, decimal point.
- Ignore filler ("preciso de", "também", "e", "por favor"), greetings, and anything that is not a
  product to buy. If nothing usable is said, return an empty items array.
- Never invent products that were not mentioned.`;

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

  let body: { text?: string; lang?: string };
  try { body = await req.json(); } catch { return json({ error: "bad JSON body" }, 400); }
  const text = String(body.text ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
  if (text.length < 2) return json({ error: "text required" }, 400);
  const lang = body.lang === "pt" ? "pt" : "en";

  // Daily cap per user (abuse / cost protection).
  const DAILY_CAP = Number(Deno.env.get("DAILY_ASSIST_CAP")) || 60;
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count: usedToday } = await admin
    .from("assist_events").select("id", { count: "exact", head: true })
    .eq("user_id", uid).eq("kind", KIND).gte("created_at", since);
  if ((usedToday ?? 0) >= DAILY_CAP) return json({ error: `daily limit reached (${DAILY_CAP} per day)` }, 429);

  const t0 = Date.now();
  const log = (ok: boolean, msg?: { usage?: { input_tokens?: number; output_tokens?: number } }) =>
    admin.from("assist_events").insert({
      user_id: uid, kind: KIND, ok, input_chars: text.length,
      input_tokens: msg?.usage?.input_tokens ?? null, output_tokens: msg?.usage?.output_tokens ?? null,
      latency_ms: Date.now() - t0,
    }).then(() => {}, () => {});
  let resp: Response;
  try {
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: SYSTEM,
        messages: [{ role: "user", content: `Language hint: ${lang === "pt" ? "Portuguese" : "English"}.\nShopping list as heard:\n"""${text}"""` }],
        output_config: { format: { type: "json_schema", schema: SCHEMA }, effort: "low" },
      }),
    });
  } catch (e) {
    await log(false);
    return json({ error: `model unreachable: ${String((e as Error).message ?? e).slice(0, 200)}` }, 502);
  }
  if (!resp.ok) {
    const errText = await resp.text();
    await log(false);
    return json({ error: `model error ${resp.status}: ${errText.slice(0, 300)}` }, 502);
  }
  const msg = await resp.json();
  await log(true, msg);
  if (msg.stop_reason === "refusal") return json({ error: "model declined this text" }, 422);
  const out = (msg.content ?? []).find((b: { type: string }) => b.type === "text")?.text ?? "";
  let parsed: { items?: { name: string; qty: number; size: string | null }[] };
  try { parsed = JSON.parse(out); } catch { return json({ error: "model returned invalid JSON" }, 502); }

  const items = (parsed.items ?? [])
    .map((it) => ({
      name: String(it.name ?? "").trim().slice(0, 80),
      qty: Number.isFinite(it.qty) && it.qty > 0 ? Math.min(it.qty, 1000) : 1,
      size: it.size ? String(it.size).trim().slice(0, 20) : null,
    }))
    .filter((it) => it.name.length > 0)
    .slice(0, 60);

  return json({ items, model: MODEL, latency_ms: Date.now() - t0 });
});
