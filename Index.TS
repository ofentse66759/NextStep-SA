// Supabase Edge Function: translate the app's fixed interface text with Gemini.
// The Gemini key is a server-side SECRET only:  supabase secrets set GEMINI_API_KEY=...
// Deploy: supabase functions deploy translate   (catalog.json must sit next to this file)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import CAT from "./catalog.json" with { type: "json" };

const LANGS: Record<string, string> = { zu: "isiZulu", xh: "isiXhosa", af: "Afrikaans", st: "Sesotho", tn: "Setswana", nso: "Sepedi", ss: "siSwati", ve: "Tshivenda", ts: "Xitsonga", nr: "isiNdebele" };
const catalog = CAT as Record<string, string>; // hash -> English. Owned by the server, so callers cannot translate arbitrary text.
const BATCH = 40;
const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const hashes = (s: string) => (s.match(/#/g) ?? []).length;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: u, error: ue } = await asUser.auth.getUser();
  if (ue || !u.user) return json({ error: "sign in required" }, 401);

  const { lang } = await req.json().catch(() => ({}));
  if (!LANGS[lang]) return json({ error: "unsupported language" }, 400);

  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: have } = await db.from("ui_translations").select("key,value").eq("lang", lang).range(0, 1999);
  const out: Record<string, string> = {};
  for (const r of have ?? []) if (r.key.startsWith("x_")) out[r.key] = r.value;

  const missing = Object.keys(catalog).filter((h) => !("x_" + h in out));
  const batch = missing.slice(0, BATCH);
  if (!batch.length) return json({ t: out, left: 0 });

  const todo = Object.fromEntries(batch.map((h) => [h, catalog[h]]));
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash"; // check Google's current model names
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": Deno.env.get("GEMINI_API_KEY")! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `Translate app interface text into ${LANGS[lang]} for young South Africans. Use short, simple, natural wording. Keep every "#" symbol exactly as is: it stands for a number. Keep NextStep SA, Scam Shield, WhatsApp, CV, SARS, CIPC, NYDA, SETA, NSFAS and similar names unchanged. Return only a JSON object with the same keys.` }] },
      contents: [{ parts: [{ text: JSON.stringify(todo) }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    }),
  });
  if (!r.ok) return json({ error: "translation service error" }, 502);
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse((await r.json()).candidates[0].content.parts[0].text); } catch { return json({ error: "bad response" }, 502); }

  const rows = [];
  for (const h of batch) {
    const v = parsed[h];
    if (typeof v !== "string") continue;
    const clean = v.replace(/[<>]/g, "").trim();
    if (clean && clean.length <= 800 && hashes(clean) === hashes(catalog[h])) { // placeholders must survive
      out["x_" + h] = clean;
      rows.push({ lang, key: "x_" + h, value: clean, reviewed: false });
    }
  }
  if (rows.length) await db.from("ui_translations").upsert(rows);
  const left = Object.keys(catalog).filter((h) => !("x_" + h in out)).length;
  return json({ t: out, left: rows.length ? left : 0 }); // stop looping if a batch yields nothing
});