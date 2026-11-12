const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const languages: Record<string, string> = {
  zu: "isiZulu",
  xh: "isiXhosa",
  af: "Afrikaans",
  nso: "Sepedi",
  st: "Sesotho",
  tn: "Setswana",
  ss: "siSwati",
  ve: "Tshivenda",
  ts: "Xitsonga",
  nr: "isiNdebele",
};
const BATCH_SIZE = 20;
const MAX_PENDING_ROWS = 1000;

type TranslationRow = { key: string; source: string; value: string | null; reviewed: boolean };

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

function countHashes(text: string) {
  return (text.match(/#/g) || []).length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return response(405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash-lite";
  if (!supabaseUrl || !anonKey || !serviceKey || !geminiKey) {
    return response(500, { error: "server_configuration_incomplete" });
  }

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return response(401, { error: "sign_in_required" });
  let body: { lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return response(400, { error: "invalid_json" });
  }
  const lang = typeof body.lang === "string" ? body.lang : "";
  if (!(lang in languages)) return response(400, { error: "unsupported_language" });

  // Verify the caller's JWT with Supabase Auth, then check admin membership server-side.
  const authResult = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  if (!authResult.ok) return response(401, { error: "invalid_session" });
  const user = await authResult.json();
  if (!user?.id) return response(401, { error: "invalid_session" });

  const restHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
  const adminUrl = new URL(`${supabaseUrl}/rest/v1/admins`);
  adminUrl.searchParams.set("select", "user_id");
  adminUrl.searchParams.set("user_id", `eq.${user.id}`);
  adminUrl.searchParams.set("limit", "1");
  const adminCheck = await fetch(adminUrl, { headers: restHeaders });
  if (!adminCheck.ok) return response(500, { error: "admin_check_failed" });
  const admins = await adminCheck.json();
  if (!Array.isArray(admins) || admins.length === 0) return response(403, { error: "admin_only" });

  // Read English source strings already catalogued for this language. Never accept
  // arbitrary text from the browser and never send user-entered data to Gemini.
  const rowsUrl = new URL(`${supabaseUrl}/rest/v1/ui_translations`);
  rowsUrl.searchParams.set("select", "key,source,value,reviewed");
  rowsUrl.searchParams.set("lang", `eq.${lang}`);
  rowsUrl.searchParams.set("reviewed", "eq.false");
  rowsUrl.searchParams.set("order", "key.asc");
  rowsUrl.searchParams.set("limit", String(MAX_PENDING_ROWS));
  const rowsResult = await fetch(rowsUrl, { headers: restHeaders });
  if (!rowsResult.ok) return response(500, { error: "translation_catalog_read_failed" });
  const rows = await rowsResult.json() as TranslationRow[];
  if (!Array.isArray(rows) || rows.length === 0) {
    return response(200, { generated: 0, left: 0, message: "translation_catalog_empty" });
  }
  const pending = rows.filter((row) =>
    typeof row.key === "string" && /^x_[a-f0-9]{1,8}$/.test(row.key) &&
    typeof row.source === "string" && row.source.trim().length > 0 &&
    row.source.length <= 800 && !String(row.value || "").trim() && row.reviewed === false
  );
  if (pending.length === 0) {
    return response(200, { generated: 0, left: 0, message: "no_blank_translation_rows" });
  }
  const batch = pending.slice(0, BATCH_SIZE);
  const input = batch.map(({ key, source }) => ({ key, source }));
  const prompt = `Translate the supplied user-interface strings into ${languages[lang]} for a youth employment prototype in South Africa. Return only JSON matching the requested schema. Keep the meaning, tone, punctuation and accessibility wording clear. Do not add explanations. Preserve every # character exactly: each # is a placeholder for a number and its count must not change. Keep product names such as NextStep SA unchanged. These are unreviewed drafts; do not make legal, safety, emergency or medical claims stronger than the English source.\n\nStrings:\n${JSON.stringify(input)}`;

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "You are a careful translation assistant. Translate only the supplied interface copy. Preserve keys and # placeholders exactly." }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              translations: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: { key: { type: "STRING" }, translation: { type: "STRING" } },
                  required: ["key", "translation"],
                },
              },
            },
            required: ["translations"],
          },
        },
      }),
    },
  );
  if (!geminiResponse.ok) return response(502, { error: "gemini_request_failed" });

  let generated: { translations?: { key: string; translation: string }[] };
  try {
    const result = await geminiResponse.json();
    const text = result?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "";
    generated = JSON.parse(text);
  } catch {
    return response(502, { error: "gemini_response_invalid" });
  }
  if (!Array.isArray(generated.translations)) return response(502, { error: "gemini_response_invalid" });

  const expected = new Map(batch.map((row) => [row.key, row.source]));
  const translations = new Map<string, string>();
  for (const item of generated.translations) {
    if (!item || !expected.has(item.key) || typeof item.translation !== "string") continue;
    const value = item.translation.trim().slice(0, 800);
    if (!value || countHashes(value) !== countHashes(expected.get(item.key)!)) continue;
    translations.set(item.key, value);
  }

  let saved = 0;
  for (const [key, value] of translations) {
    const updateUrl = new URL(`${supabaseUrl}/rest/v1/ui_translations`);
    updateUrl.searchParams.set("lang", `eq.${lang}`);
    updateUrl.searchParams.set("key", `eq.${key}`);
    updateUrl.searchParams.set("reviewed", "eq.false");
    updateUrl.searchParams.set("or", "(value.is.null,value.eq.)");
    const update = await fetch(updateUrl, {
      method: "PATCH",
      headers: { ...restHeaders, Prefer: "return=representation" },
      body: JSON.stringify({ value }),
    });
    if (!update.ok) continue;
    const changed = await update.json();
    if (Array.isArray(changed) && changed.length > 0) saved += changed.length;
  }

  const remaining = pending.length - saved;
  return response(200, { generated: saved, left: Math.max(0, remaining) });
});
