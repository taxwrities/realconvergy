/* ================================================================
   decode.mjs — Decode Chat proxy (DECODE-CHAT.md, Netlify function)
   Zero-dependency by design: apps/mlb/netlify.toml sets
   node_bundler = "none", so this file must run as-is on Netlify's
   Node runtime (native fetch). API key lives server-side only —
   set ANTHROPIC_API_KEY in the Netlify site environment.

   POST body: {
     mode:    'standard' | 'deep',
     system:  [{text, cache?: '1h'|'5m'}],   // ordered — static blocks first
     messages:[{role:'user'|'assistant', content}],
     app?:    'mlb' | 'lovable'              // shared function, keyed by app (Q6)
   }
   Reply: { text, model, stop_reason } or { error }
================================================================ */

const API = 'https://api.anthropic.com/v1/messages';
const MODELS = {
  standard: 'claude-sonnet-5',   // default decode voice
  deep:     'claude-fable-5',    // "Deep Decode" — user-initiated only
};
/* Fable 5 thinks always-on and thinking spends max_tokens, so deep gets
   headroom beyond the spec's 2500 visible-text intent. */
const MAX_TOKENS = { standard: 1200, deep: 4000 };
const TURN_CAP  = 30;            // hard session cap (spec)
const CHAR_CAP  = 400_000;       // request-size sanity ceiling

const json = (status, obj) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key)
    return json(503, {
      error: 'Decode is not configured yet — set ANTHROPIC_API_KEY in the Netlify site environment.',
    });

  let body;
  try { body = await req.json(); }
  catch { return json(400, { error: 'bad JSON' }); }

  const mode = body.mode === 'deep' ? 'deep' : 'standard';
  const system = Array.isArray(body.system) ? body.system : [];
  const messages = Array.isArray(body.messages) ? body.messages : [];

  if (!messages.length) return json(400, { error: 'no messages' });
  if (messages.filter((m) => m.role === 'user').length > TURN_CAP)
    return json(400, { error: `session cap: ${TURN_CAP} turns — start a new session` });
  const totalChars = JSON.stringify(body).length;
  if (totalChars > CHAR_CAP) return json(413, { error: 'bundle too large' });

  /* system blocks → cache_control on flagged blocks (prefix-match caching;
     static blocks first, max 4 breakpoints — the client flags at most 4). */
  let breakpoints = 0;
  const sys = system
    .filter((b) => b && typeof b.text === 'string' && b.text)
    .map((b) => {
      const blk = { type: 'text', text: b.text };
      if (b.cache && breakpoints < 4) {
        blk.cache_control =
          b.cache === '1h' ? { type: 'ephemeral', ttl: '1h' } : { type: 'ephemeral' };
        breakpoints++;
      }
      return blk;
    });

  const payload = {
    model: MODELS[mode],
    max_tokens: MAX_TOKENS[mode],
    system: sys,
    messages: messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content ?? ''),
    })),
  };
  const headers = {
    'content-type': 'application/json',
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
  };
  if (mode === 'standard') {
    /* fast 3-line-style replies; Sonnet 5 thinks by default and thinking
       counts against max_tokens, so switch it off for the quick voice */
    payload.thinking = { type: 'disabled' };
  } else {
    /* Fable 5: thinking always on (omit the param). Safety classifiers can
       decline with stop_reason "refusal" — opt into the server-side default
       fallback so a decline is re-served by the recommended model. */
    payload.fallbacks = 'default';
    headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
  }

  let resp, data;
  try {
    resp = await fetch(API, { method: 'POST', headers, body: JSON.stringify(payload) });
    data = await resp.json();
  } catch (e) {
    return json(502, { error: `upstream unreachable: ${e.message}` });
  }

  if (!resp.ok)
    return json(resp.status === 429 ? 429 : 502, {
      error: data?.error?.message || `API error ${resp.status}`,
    });

  if (data.stop_reason === 'refusal')
    return json(200, {
      text: '⟂ Deep Decode declined this request (safety classifier). Rephrase, or use standard mode.',
      model: data.model,
      stop_reason: 'refusal',
    });

  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  return json(200, {
    text: text || '(empty response)',
    model: data.model,
    stop_reason: data.stop_reason,
  });
};
