/**
 * AethexFlow Edge — single independent Worker
 * No service-binding maze. One deploy. One origin.
 *
 * Routes:
 *   /api/chat          → Workers AI (or external key fallback)
 *   /api/health        → status
 *   /api/admin/*       → owner-checked site intent parser + D1
 *   /api/hub/*         → proxy helpers for local Aethi Hub (CORS only)
 *   /*                 → static from PAGES_ORIGIN (or ASSETS if bound)
 *
 * Env (wrangler.toml [vars] + secrets):
 *   PAGES_ORIGIN       optional  https://your-pages.pages.dev
 *   APEX_DOMAIN        optional  aethexflow.online
 *   AI_MODEL           default   @cf/meta/llama-3.3-70b-instruct-fp8-fast
 *   ADMIN_OWNER_KEY    secret    required owner key (32+ random characters)
 *   AETHI_DB           binding   global site settings and audit metadata only
 *   GEMINI_API_KEY     secret    optional external fallback
 */

const SECURITY = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'SAMEORIGIN',
  'permissions-policy': 'camera=(), geolocation=(), payment=(), usb=()',
};

const ALLOWED_HUB_ORIGINS = new Set([
  'https://aethexflow.online',
  'https://www.aethexflow.online',
]);
const SITE_SETTING_KEYS = new Set([
  'announcementBanner',
  'maintenanceMode',
  'edgeCacheMode',
  'targetDomain',
]);

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...SECURITY,
      ...extra,
    },
  });
}

function corsHeaders(origin) {
  const h = {
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization, X-Owner-Key',
  };
  if (origin && ALLOWED_HUB_ORIGINS.has(origin)) {
    h['access-control-allow-origin'] = origin;
    h['vary'] = 'Origin';
  }
  return h;
}

function constantTimeEquals(left, right) {
  const a = new TextEncoder().encode(String(left));
  const b = new TextEncoder().encode(String(right));
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) difference |= (a[i] || 0) ^ (b[i] || 0);
  return difference === 0;
}

function hasConfiguredOwnerKey(env) {
  return typeof env.ADMIN_OWNER_KEY === 'string' && env.ADMIN_OWNER_KEY.length >= 32;
}

function hasOwnerAccess(request, env) {
  const configured = env.ADMIN_OWNER_KEY;
  const supplied = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ||
    request.headers.get('X-Owner-Key') || '';
  return Boolean(hasConfiguredOwnerKey(env) && supplied && constantTimeEquals(supplied, configured));
}

async function readAdminBody(request) {
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 16_384) return null;
  try {
    const value = await request.json();
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function parseSettingValue(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function loadSiteSettings(db) {
  const result = await db.prepare(
    'SELECT setting_key, setting_value FROM site_settings ORDER BY setting_key'
  ).all();
  const siteConfig = {
    announcementBanner: '',
    maintenanceMode: false,
    edgeCacheMode: 'standard',
    targetDomain: 'aethexflow.online',
  };
  for (const row of result.results || []) {
    if (SITE_SETTING_KEYS.has(row.setting_key)) {
      siteConfig[row.setting_key] = parseSettingValue(row.setting_value);
    }
  }
  return siteConfig;
}

function parseSiteIntent(instruction) {
  const lower = instruction.toLowerCase();
  const changes = {};
  if (/\bmaintenance\s+on\b/.test(lower)) changes.maintenanceMode = true;
  if (/\bmaintenance\s+off\b/.test(lower)) changes.maintenanceMode = false;

  const banner = instruction.match(/(?:banner|announcement)\s*[:=]\s*["“']?([^"”'\n]+)["”']?/i)?.[1]?.trim();
  if (banner) changes.announcementBanner = banner.slice(0, 160);

  const cacheMode = lower.match(/(?:edge\s+)?cache(?:\s+mode)?(?:\s+to)?\s+(aggressive|standard|conservative|off)\b/)?.[1];
  if (cacheMode) changes.edgeCacheMode = cacheMode;

  if (/\b(tunnel|local hub|local device)\b/.test(lower)) {
    return { intentType: 'TUNNEL_LOCAL_EXEC', changes: {} };
  }
  if (Object.keys(changes).length) return { intentType: 'UPDATE_SITE_CONFIG', changes };
  return null;
}

async function hashRateLimitKey(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function checkOwnerLoginLimit(db, request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `admin-gateway:${await hashRateLimitKey(ip)}`;
  const now = Date.now();
  const row = await db.prepare('SELECT attempts, expires_at FROM auth_rate_limits WHERE bucket = ?')
    .bind(key).first();
  if (row?.attempts >= 5 && row.expires_at > now) {
    return { blocked: true, retryAfter: Math.ceil((row.expires_at - now) / 1000), key };
  }
  return { blocked: false, key };
}

async function recordOwnerLoginFailure(db, key) {
  const now = Date.now();
  await db.prepare(`
    INSERT INTO auth_rate_limits (bucket, attempts, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(bucket) DO UPDATE SET
      attempts = CASE WHEN auth_rate_limits.expires_at <= ? THEN 1 ELSE auth_rate_limits.attempts + 1 END,
      expires_at = CASE WHEN auth_rate_limits.expires_at <= ? THEN ? ELSE auth_rate_limits.expires_at END
  `).bind(key, now + 10 * 60 * 1000, now, now, now + 10 * 60 * 1000).run();
}

async function clearOwnerLoginFailures(db, key) {
  await db.prepare('DELETE FROM auth_rate_limits WHERE bucket = ?').bind(key).run();
}

async function handleAdminAuth(request, env) {
  if (!env.AETHI_DB || !hasConfiguredOwnerKey(env)) {
    return json({ ok: false, error: 'Set a random owner key of at least 32 characters and configure D1.' }, 503);
  }
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  const rate = await checkOwnerLoginLimit(env.AETHI_DB, request);
  if (rate.blocked) {
    return json({ ok: false, error: `Too many attempts. Try again in ${rate.retryAfter}s.` }, 429, {
      'retry-after': String(rate.retryAfter),
    });
  }
  const body = await readAdminBody(request);
  const supplied = String(body?.token || body?.passcode || '');
  if (!supplied || !constantTimeEquals(supplied, env.ADMIN_OWNER_KEY)) {
    await recordOwnerLoginFailure(env.AETHI_DB, rate.key);
    return json({ ok: false, error: 'Owner key was not accepted.' }, 401);
  }
  await clearOwnerLoginFailures(env.AETHI_DB, rate.key);
  return json({ ok: true, sessionToken: supplied, mode: 'owner-key' });
}

async function handleAdminState(request, env) {
  if (!env.AETHI_DB || !hasConfiguredOwnerKey(env)) {
    return json({ ok: false, error: 'Set a random owner key of at least 32 characters and configure D1.' }, 503);
  }
  if (request.method !== 'GET') return json({ error: 'GET only' }, 405);
  if (!hasOwnerAccess(request, env)) return json({ ok: false, error: 'Unauthorized' }, 401);
  const [siteConfig, updates] = await Promise.all([
    loadSiteSettings(env.AETHI_DB),
    env.AETHI_DB.prepare(
      'SELECT id, intent_type, payload_json, created_at FROM site_updates ORDER BY created_at DESC LIMIT 15'
    ).all(),
  ]);
  return json({
    ok: true,
    targetDomain: siteConfig.targetDomain || 'aethexflow.online',
    d1Bound: true,
    tunnelTarget: 'local device only',
    siteConfig,
    recentUpdates: (updates.results || []).map((row) => ({
      ...row,
      model_used: 'Aethi intent parser',
      route_target: row.intent_type === 'UPDATE_SITE_CONFIG' ? 'Cloudflare D1' : 'local device',
    })),
  });
}

async function handleAdminDispatch(request, env) {
  if (!env.AETHI_DB || !hasConfiguredOwnerKey(env)) {
    return json({ ok: false, error: 'Set a random owner key of at least 32 characters and configure D1.' }, 503);
  }
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!hasOwnerAccess(request, env)) return json({ ok: false, error: 'Unauthorized' }, 401);
  const body = await readAdminBody(request);
  const instruction = String(body?.instruction || '').trim().slice(0, 1500);
  if (!instruction) return json({ ok: false, error: 'Instruction is required.' }, 400);

  const parsed = parseSiteIntent(instruction);
  if (!parsed) return json({ ok: false, error: 'The site intent parser could not match a supported update.' }, 400);
  if (parsed.intentType === 'TUNNEL_LOCAL_EXEC') {
    return json({
      ok: true,
      modelUsed: 'Aethi intent parser',
      routeTarget: 'local device',
      intentType: parsed.intentType,
      changes: {},
      d1Persisted: false,
      assistantReply: 'This request stays on your device. Connect the Aethi Local Hub to run a supported local action.',
      tunnelResult: { attempted: false, delivered: false, endpoint: 'local device', note: 'No command was sent or stored in D1.' },
      recentUpdates: [],
      timestamp: new Date().toISOString(),
    });
  }

  const id = `upd_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  const payloadJson = JSON.stringify(parsed.changes);
  const statements = Object.entries(parsed.changes).map(([key, value]) =>
    env.AETHI_DB.prepare(`
      INSERT INTO site_settings (setting_key, setting_value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at
    `).bind(key, JSON.stringify(value), Date.now())
  );
  statements.push(
    env.AETHI_DB.prepare(
      'INSERT INTO site_updates (id, intent_type, payload_json, created_at) VALUES (?, ?, ?, ?)'
    ).bind(id, parsed.intentType, payloadJson, createdAt),
    env.AETHI_DB.prepare(
      'INSERT INTO owner_audit (action, details, created_at) VALUES (?, ?, ?)'
    ).bind('site_update', JSON.stringify({ settingKeys: Object.keys(parsed.changes) }), Date.now()),
  );
  await env.AETHI_DB.batch(statements);

  const [siteConfig, updates] = await Promise.all([
    loadSiteSettings(env.AETHI_DB),
    env.AETHI_DB.prepare(
      'SELECT id, intent_type, payload_json, created_at FROM site_updates ORDER BY created_at DESC LIMIT 10'
    ).all(),
  ]);
  return json({
    ok: true,
    modelUsed: 'Aethi intent parser',
    routeTarget: 'Cloudflare D1',
    intentType: parsed.intentType,
    changes: parsed.changes,
    d1Persisted: true,
    siteConfig,
    assistantReply: 'Site settings were updated and recorded in D1.',
    tunnelResult: { attempted: false, delivered: false, endpoint: 'local device', note: 'No local device command was sent.' },
    recentUpdates: updates.results || [],
    timestamp: createdAt,
  });
}

function textOf(m) {
  if (typeof m === 'string') return m;
  if (!m || typeof m !== 'object') return '';
  if (typeof m.content === 'string') return m.content;
  if (typeof m.text === 'string') return m.text;
  if (typeof m.message === 'string') return m.message;
  if (Array.isArray(m.content)) return m.content.map((p) => (p && (p.text || p.content)) || '').join('');
  return '';
}

function normalizeMessages(body) {
  if (!body || typeof body !== 'object') return null;
  let messages = Array.isArray(body.messages) ? body.messages : null;
  if (!messages) {
    for (const k of ['history', 'conversation', 'chat', 'thread']) {
      if (Array.isArray(body[k])) { messages = body[k]; break; }
    }
  }
  if (messages) {
    messages = messages
      .map((m) => ({
        role: (m && (m.role || m.sender || m.from)) || 'user',
        content: textOf(m),
      }))
      .filter((m) => m.content);
  }
  if (!messages || !messages.length) {
    for (const k of ['prompt', 'message', 'text', 'input', 'content', 'query', 'q']) {
      const v = body[k];
      if (typeof v === 'string' && v.trim()) {
        messages = [{ role: 'user', content: v.trim() }];
        break;
      }
    }
  }
  return messages && messages.length ? messages : null;
}

async function runWorkersAI(env, messages) {
  if (!env.AI || typeof env.AI.run !== 'function') {
    return { ok: false, error: 'Workers AI binding missing' };
  }
  const model = env.AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  const result = await env.AI.run(model, {
    messages: [
      {
        role: 'system',
        content:
          'You are Aethi, the local-first AI copilot of AethexFlow. Be concise, accurate, and never invent capabilities that do not exist. Prefer actionable answers.',
      },
      ...messages,
    ],
    max_tokens: 1024,
  });
  const reply =
    (typeof result === 'string' && result) ||
    result?.response ||
    result?.result?.response ||
    result?.text ||
    JSON.stringify(result);
  return { ok: true, reply: String(reply), model, routed_via: 'workers-ai' };
}

async function runGeminiFallback(env, messages) {
  const key = env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: 'No Gemini key' };
  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents }),
  });
  if (!res.ok) return { ok: false, error: `Gemini ${res.status}` };
  const data = await res.json();
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { ok: true, reply, model, routed_via: 'gemini' };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    // www → apex
    const apex = (env.APEX_DOMAIN || '').toLowerCase();
    if (apex && url.hostname.toLowerCase() === `www.${apex}`) {
      return Response.redirect(`https://${apex}${url.pathname}${url.search}`, 301);
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...SECURITY, ...corsHeaders(origin) } });
    }

    // ── Health ──────────────────────────────────────────────────────────
    if (url.pathname === '/api/health' || url.pathname === '/health') {
      return json(
        {
          status: 'online',
          agent: 'aethi',
          version: '5.0.0-edge',
          ai_bound: !!(env.AI && typeof env.AI.run === 'function'),
          pages: !!(env.PAGES_ORIGIN || env.ASSETS),
        },
        200,
        corsHeaders(origin)
      );
    }

    // ── Chat ────────────────────────────────────────────────────────────
    if (url.pathname === '/api/chat' || url.pathname === '/api/v1/chat/completions') {
      if (request.method !== 'POST') return json({ error: 'POST only' }, 405, corsHeaders(origin));

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON' }, 400, corsHeaders(origin));
      }

      const messages = normalizeMessages(body);
      if (!messages) return json({ error: 'No message found' }, 400, corsHeaders(origin));

      // Owner gate (optional)
      const ownerKey = request.headers.get('X-Owner-Key') || '';
      if (env.ADMIN_OWNER_KEY && ownerKey && ownerKey !== env.ADMIN_OWNER_KEY) {
        return json({ error: 'Invalid owner key' }, 403, corsHeaders(origin));
      }

      let result = await runWorkersAI(env, messages);
      if (!result.ok) result = await runGeminiFallback(env, messages);
      if (!result.ok) {
        return json(
          { error: 'No AI backend available', detail: result.error },
          503,
          corsHeaders(origin)
        );
      }

      return json(
        {
          ok: true,
          reply: result.reply,
          text: result.reply,
          response: result.reply,
          message: result.reply,
          model: result.model,
          routed_via: result.routed_via,
        },
        200,
        corsHeaders(origin)
      );
    }

    if (url.pathname === '/api/aethi/tasks') {
      return json({ ok: false, error: 'Device tasks are stored locally and are not accepted by the site.' }, 410, corsHeaders(origin));
    }

    // ── Zero-trust site administration ──────────────────────────────────
    // Only global site settings and change metadata go to D1. User chat,
    // attachments, and device tasks stay on the user's device.
    if (url.pathname === '/api/admin/auth') return handleAdminAuth(request, env);
    if (url.pathname === '/api/admin/state') return handleAdminState(request, env);
    if (url.pathname === '/api/admin/dispatch') return handleAdminDispatch(request, env);

    // ── Owner panel ─────────────────────────────────────────────────────
    if (url.pathname === '/api/owner/status' || url.pathname === '/api/owner/claims') {
      const key = request.headers.get('X-Owner-Key') || '';
      if (!hasConfiguredOwnerKey(env) || !constantTimeEquals(key, env.ADMIN_OWNER_KEY)) {
        return json({ error: 'Unauthorized' }, 401, corsHeaders(origin));
      }

      const aiBound = !!(env.AI && typeof env.AI.run === 'function');
      const gemini = !!env.GEMINI_API_KEY;
      const pages = !!(env.PAGES_ORIGIN || env.ASSETS);

      // Truthful capability matrix — no marketing labels
      const claims = {
        version: '5.0.0-edge',
        ai: {
          workers_ai: aiBound,
          model: env.AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
          gemini_fallback: gemini,
          status: aiBound || gemini ? 'live' : 'offline',
        },
        routing: {
          single_worker: true,
          service_bindings: false,
          pages_proxy: pages,
          pages_origin: env.PAGES_ORIGIN || null,
          apex: env.APEX_DOMAIN || null,
        },
        local_hub: {
          expected_port: 251,
          expected_host: '127.0.1.1',
          note: 'Pair via 6-digit code. Hub reports its own health.',
        },
        // Explicitly mark what is NOT claimed by this edge
        not_claimed_by_edge: [
          'enterprise_tier',
          'video_studio_render',
          'background_remover_server',
          'crm_workflows',
          'fake_execution_log',
          'ready_badges_on_frontend',
        ],
        note: 'Frontend badges/labels live in Pages project. Edge only reports real backend state.',
      };

      return json({ status: 'ok', claims }, 200, corsHeaders(origin));
    }

    // ── Static / Pages proxy ────────────────────────────────────────────
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      const res = await env.ASSETS.fetch(request);
      const headers = new Headers(res.headers);
      for (const [k, v] of Object.entries(SECURITY)) headers.set(k, v);
      return new Response(res.body, { status: res.status, headers });
    }

    const pages = (env.PAGES_ORIGIN || '').replace(/\/+$/, '');
    if (pages) {
      const target = pages + url.pathname + url.search;
      try {
        const res = await fetch(new Request(target, request));
        const headers = new Headers(res.headers);
        headers.delete('content-encoding');
        headers.delete('content-length');
        for (const [k, v] of Object.entries(SECURITY)) headers.set(k, v);
        return new Response(res.body, { status: res.status, headers });
      } catch {
        return json({ error: 'Upstream Pages unavailable' }, 502);
      }
    }

    return json({ error: 'Not found. Configure PAGES_ORIGIN or ASSETS.' }, 404);
  },
};
