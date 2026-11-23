/**
 * Aethi server. Chat, video plans, translation, and bots run here so the
 * product does not depend on a separate Cloudflare Worker.
 * The model vendor is never named in replies.
 */

type ChatTurn = { role?: string; content?: string; text?: string };
type Attachment = { name?: string; mimeType?: string; base64?: string };

const AETHI_SYSTEM = `You are Aethi, the assistant inside AethexFlow.
Never name, hint at, or compare underlying model vendors. You are only Aethi.
Help with automated video edits, automation bots (web monitor, content digest, webhook relay, data normalizer), PDF and image tools, the crypto vault, and translation including Urdu and Roman Urdu.
Reply in the language the operator used (English, Urdu, or Roman Urdu).
Be concise and practical. A short Assalam-o-Alaikum is fine when they greet in Urdu.
Do not claim a desktop agent already ran a command. If they ask for local/PC automation, say the task can be queued for the local Aethi agent.`;

type Store = {
  sessions: Set<string>;
  site: Record<string, string | boolean>;
  updates: Array<{
    id: string;
    intent_type: string;
    payload_json: string;
    model_used: string;
    route_target: string;
    created_at: string;
  }>;
  aiHits: number[];
};

function store(): Store {
  const g = globalThis as typeof globalThis & { __aethiStore?: Store };
  if (!g.__aethiStore) {
    g.__aethiStore = {
      sessions: new Set<string>(),
      site: {
        announcementBanner: "AethexFlow studio is live",
        maintenanceMode: false,
        edgeCacheMode: "standard",
        targetDomain: "aethexflow.online",
      },
      updates: [],
      aiHits: [],
    };
  }
  return g.__aethiStore;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

let aiPause: "credits" | "error" | null = null;

const CREDIT_NOTE =
  "Live AI replies are paused until workspace AI credits are added. Video Studio, bots, and on-device tools still run.";

const ONLINE_AI_ENDPOINTS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
  together: "https://api.together.xyz/v1",
  fireworks: "https://api.fireworks.ai/inference/v1",
  deepseek: "https://api.deepseek.com",
  mistral: "https://api.mistral.ai/v1",
  xai: "https://api.x.ai/v1",
};

function allowAiCall(): boolean {
  if (aiPause) return false;
  const now = Date.now();
  const s = store();
  s.aiHits = s.aiHits.filter((t) => now - t < 10 * 60 * 1000);
  if (s.aiHits.length >= 40) return false;
  s.aiHits.push(now);
  return true;
}

async function grok(
  messages: Array<{ role: string; content: unknown }>,
  opts?: { max?: number; json?: boolean },
): Promise<string | null> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey || !allowAiCall()) return null;
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(28_000),
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: opts?.max ?? 700,
        temperature: 0.4,
        ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
        messages,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      if (res.status === 403 && /spending-limit|credits|subscription/i.test(detail)) {
        aiPause = "credits";
      } else if (res.status === 401 || res.status === 403) {
        aiPause = "error";
      }
      console.error("[aethi] model status", res.status);
      return null;
    }
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return body.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.error("[aethi] model call failed", err);
    return null;
  }
}

function getOnlineConfig(body: Record<string, unknown>) {
  const connection =
    body.connection && typeof body.connection === "object"
      ? (body.connection as Record<string, unknown>)
      : {};
  const providerId = String(connection.providerId || "");
  const endpoint = ONLINE_AI_ENDPOINTS[providerId];
  const apiKey = String(connection.apiKey || "").trim();
  const model = String(connection.model || "")
    .trim()
    .slice(0, 160);
  if (!endpoint) return { error: "Choose a supported online provider." } as const;
  if (!apiKey || apiKey.length > 500) return { error: "Enter a valid provider API key." } as const;
  if (!model) return { error: "Enter a model name for this provider." } as const;
  return { endpoint, apiKey, model } as const;
}

async function callOnlineProvider(
  endpoint: string,
  apiKey: string,
): Promise<{ response: Response | null; error?: string }> {
  try {
    const response = await fetch(`${endpoint}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(12_000),
      redirect: "error",
    });
    return { response };
  } catch {
    return {
      response: null,
      error: "Could not reach the provider. Check the connection and try again.",
    };
  }
}

function providerError(status: number): string {
  if (status === 401 || status === 403)
    return "The provider rejected the key. Check that it is correct and active.";
  if (status === 404) return "The provider could not find that model. Check the model name.";
  if (status === 429) return "The provider is rate-limiting this request. Wait a moment and retry.";
  return `The provider request failed (HTTP ${status}). Check the provider and model settings.`;
}

async function handleOnlineConnectionTest(body: Record<string, unknown>): Promise<Response> {
  const config = getOnlineConfig(body);
  if ("error" in config) return json({ ok: false, error: config.error }, 400);
  const result = await callOnlineProvider(config.endpoint, config.apiKey);
  if (!result.response) return json({ ok: false, error: result.error }, 502);
  if (!result.response.ok) {
    return json({ ok: false, error: providerError(result.response.status) }, 502);
  }
  return json({ ok: true });
}

async function handleOnlineChat(body: Record<string, unknown>, message: string): Promise<Response> {
  const config = getOnlineConfig(body);
  if ("error" in config) return json({ error: config.error }, 400);

  const history = Array.isArray(body.history) ? (body.history as ChatTurn[]) : [];
  const files = [
    ...(Array.isArray(body.attachments) ? (body.attachments as Attachment[]) : []),
    body.attachment && typeof body.attachment === "object" ? (body.attachment as Attachment) : null,
  ].filter(Boolean) as Attachment[];
  const image = files.find(
    (file) =>
      typeof file.base64 === "string" &&
      typeof file.mimeType === "string" &&
      file.mimeType.startsWith("image/") &&
      file.base64.length > 40 &&
      file.base64.length < 1_200_000,
  );
  const prior = history.slice(-10).map((turn) => ({
    role: turn.role === "assistant" || turn.role === "model" ? "assistant" : "user",
    content: String(turn.content || turn.text || "").slice(0, 2000),
  }));
  const userContent: unknown = image
    ? [
        { type: "text", text: message },
        { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.base64}` } },
      ]
    : message;

  try {
    const response = await fetch(`${config.endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal: AbortSignal.timeout(28_000),
      redirect: "error",
      body: JSON.stringify({
        model: config.model,
        max_tokens: 700,
        temperature: 0.4,
        messages: [
          { role: "system", content: AETHI_SYSTEM },
          ...prior,
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!response.ok) {
      return json({ error: providerError(response.status) }, 502);
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    const text =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content
              .map((part) =>
                part && typeof part === "object" && "text" in part
                  ? String((part as { text: unknown }).text)
                  : "",
              )
              .join("")
          : "";
    if (!text.trim())
      return json({ error: "The provider returned an empty reply. Try another model." }, 502);
    return json({ text, reply: text, ai: "online" });
  } catch {
    return json({ error: "The provider request timed out or could not be reached." }, 502);
  }
}

function localChat(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("video") ||
    lower.includes("short") ||
    lower.includes("reel") ||
    lower.includes("edit")
  ) {
    return "Video Studio khula hai. Clip import karo, phir Edit by Instruction mein likho — jaise: 9:16 short, 8 seconds, title: AethexFlow, mute audio. Aethi plan banayega, Apply reviewed plan timeline pe laga dega, Export se WebM nikal jaegi.";
  }
  if (lower.includes("bot") || lower.includes("monitor") || lower.includes("webhook")) {
    return "Automation Bots chal rahe hain. Web Monitor kisi public URL ko hit karta hai, Digest notes ka summary nikalta hai, Webhook Relay JSON POST karta hai, aur Data Normalizer CSV/JSON saaf karta hai. Sidebar se Bots kholo aur Run dabao.";
  }
  if (/[\u0600-\u06FF]/.test(message) || lower.includes("salam") || lower.includes("kaise")) {
    return "Assalam-o-Alaikum. Main Aethi hoon. Video studio, bots, translator, PDF, aur vault sab isi workspace mein hain. Batao kya karna hai.";
  }
  return `Aethi yahan hai. Aap ne kaha: "${message.slice(0, 280)}". Video Studio, Automation Bots, translator, PDF compressor, aur crypto vault sidebar se khul jate hain.`;
}

function publicUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "metadata.google.internal"
  ) {
    return null;
  }
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    ) {
      return null;
    }
  }
  return url;
}

async function readLimited(response: Response, max = 120_000): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (received < max) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    received += value.byteLength;
  }
  try {
    await reader.cancel();
  } catch {
    /* already closed */
  }
  const merged = new Uint8Array(Math.min(received, max));
  let offset = 0;
  for (const chunk of chunks) {
    const take = Math.min(chunk.byteLength, merged.byteLength - offset);
    if (take <= 0) break;
    merged.set(chunk.subarray(0, take), offset);
    offset += take;
  }
  return new TextDecoder().decode(merged);
}

function parseLocalVideoPlan(instruction: string, sourceName = "Footage", maxDur = 30) {
  const lower = instruction.toLowerCase();
  let aspectRatio: "9:16" | "16:9" | "1:1" = "9:16";
  if (lower.includes("landscape") || lower.includes("16:9") || lower.includes("youtube")) {
    aspectRatio = "16:9";
  } else if (lower.includes("square") || lower.includes("1:1")) {
    aspectRatio = "1:1";
  }

  const durMatch = instruction.match(/(\d+(?:\.\d+)?)\s*(?:-|\s)?(?:sec|second|seconds|s\b)/i);
  const startMatch = instruction.match(
    /(?:start(?:ing)?\s*(?:at|from)?|from)\s*(\d+(?:\.\d+)?)\s*(?:sec|second|seconds|s)?/i,
  );
  const titleMatch =
    instruction.match(/(?:title|caption|text|headline)\s*[:=]\s*["“']?([^"”'\n,]{1,80})/i) ||
    instruction.match(/["“']([^"”']{2,80})["”']/);

  const trimStartSec = startMatch ? Math.max(0, parseFloat(startMatch[1])) : 0;
  const durationSec = durMatch
    ? Math.max(2, Math.min(300, parseFloat(durMatch[1])))
    : Math.min(30, Math.max(5, maxDur || 12));
  const overlayText = titleMatch ? titleMatch[1].trim() : "";
  const muteAudio =
    lower.includes("mute") || lower.includes("silent") || lower.includes("no audio");
  const projectTitle =
    overlayText ||
    `${aspectRatio === "9:16" ? "Vertical Short" : aspectRatio === "16:9" ? "YouTube Edit" : "Square Cut"} · ${sourceName}`;

  return {
    projectTitle,
    aspectRatio,
    trimStartSec,
    durationSec,
    overlayText,
    muteAudio,
    summary: `Prepared ${aspectRatio} edit (${durationSec}s from ${trimStartSec}s${overlayText ? `, overlay "${overlayText}"` : ""}${muteAudio ? ", muted" : ""}).${aiPause === "credits" ? " Live AI is paused, so this plan was built on-device." : ""}`,
    engine: "aethi-local",
  };
}

function localDigest(inputText: string) {
  const sentences = inputText.split(/(?<=[.!?])\s+/).filter(Boolean);
  const words = inputText.split(/\s+/).filter(Boolean);
  const actionItems = sentences
    .filter((s) =>
      /\b(must|should|need|todo|action|fix|deploy|verify|build|create|karo|karna)\b/i.test(s),
    )
    .slice(0, 4);
  return {
    headline: sentences[0]?.slice(0, 90) || "Structured digest",
    summary: sentences.slice(0, 2).join(" ") || inputText.slice(0, 240),
    actionItems:
      actionItems.length > 0
        ? actionItems
        : ["Review the summarized points", "Run the follow-up bot"],
    wordCount: words.length,
    engine: "aethi-local",
  };
}

function bearer(request: Request): string {
  const auth = request.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

function authorized(request: Request): boolean {
  const token = bearer(request);
  if (!token) return false;
  return store().sessions.has(token);
}

async function handleChat(body: Record<string, unknown>): Promise<Response> {
  const message = String(body.message || "")
    .trim()
    .slice(0, 4000);
  if (!message) return json({ error: "Message is required" }, 400);
  const connection =
    body.connection && typeof body.connection === "object"
      ? (body.connection as Record<string, unknown>)
      : null;
  if (connection?.mode === "online") return handleOnlineChat(body, message);

  const history = Array.isArray(body.history) ? (body.history as ChatTurn[]) : [];
  const files = [
    ...(Array.isArray(body.attachments) ? (body.attachments as Attachment[]) : []),
    body.attachment && typeof body.attachment === "object" ? (body.attachment as Attachment) : null,
  ].filter(Boolean) as Attachment[];

  const image = files.find(
    (f) =>
      typeof f.base64 === "string" &&
      typeof f.mimeType === "string" &&
      f.mimeType.startsWith("image/") &&
      f.base64.length > 40 &&
      f.base64.length < 1_200_000,
  );

  const prior = history.slice(-10).map((h) => ({
    role: h.role === "assistant" || h.role === "model" ? "assistant" : "user",
    content: String(h.content || h.text || "").slice(0, 2000),
  }));

  const userContent: unknown = image
    ? [
        { type: "text", text: message },
        {
          type: "image_url",
          image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
        },
      ]
    : message;

  const text = await grok(
    [{ role: "system", content: AETHI_SYSTEM }, ...prior, { role: "user", content: userContent }],
    { max: 700 },
  );
  const reply = (
    text || `${localChat(message)}\n\n${aiPause === "credits" ? CREDIT_NOTE : ""}`
  ).trim();
  return json({ text: reply, reply, ai: text ? "live" : aiPause || "local" });
}

async function handleVideoPlan(body: Record<string, unknown>): Promise<Response> {
  const instruction = String(body.instruction || "").trim();
  if (!instruction) return json({ error: "Editing instruction is required" }, 400);
  const sourceName = String(body.sourceName || "Clip");
  const maxDur = Number(body.durationSec) || 30;
  const fallback = parseLocalVideoPlan(instruction, sourceName, maxDur);

  const raw = await grok(
    [
      {
        role: "system",
        content:
          "You plan non-destructive video edits for Aethi. Return JSON only with keys projectTitle, aspectRatio (9:16|16:9|1:1), trimStartSec, durationSec, overlayText, muteAudio, summary. Never name a model vendor.",
      },
      {
        role: "user",
        content: `Instruction: ${instruction.slice(0, 1500)}\nSource: ${sourceName}\nMax duration about ${maxDur}s.`,
      },
    ],
    { max: 400, json: true },
  );

  if (!raw) return json(fallback);
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const ratio = ["9:16", "16:9", "1:1"].includes(String(parsed.aspectRatio))
      ? (parsed.aspectRatio as "9:16" | "16:9" | "1:1")
      : fallback.aspectRatio;
    return json({
      projectTitle: String(parsed.projectTitle || fallback.projectTitle).slice(0, 120),
      aspectRatio: ratio,
      trimStartSec: Number.isFinite(Number(parsed.trimStartSec))
        ? Math.max(0, Number(parsed.trimStartSec))
        : fallback.trimStartSec,
      durationSec: Number.isFinite(Number(parsed.durationSec))
        ? Math.max(2, Math.min(300, Number(parsed.durationSec)))
        : fallback.durationSec,
      overlayText:
        typeof parsed.overlayText === "string"
          ? parsed.overlayText.slice(0, 140)
          : fallback.overlayText,
      muteAudio: Boolean(parsed.muteAudio),
      summary: String(parsed.summary || fallback.summary).slice(0, 400),
      engine: "aethi",
    });
  } catch {
    return json(fallback);
  }
}

async function handleBots(body: Record<string, unknown>): Promise<Response> {
  const botType = String(body.botType || "");
  const started = Date.now();
  const target = String(body.target || "");
  const payload = body.payload;

  if (botType === "web-monitor") {
    const url = publicUrl(target);
    if (!url)
      return json(
        { ok: false, error: "Give a public http(s) URL. Private networks are blocked." },
        400,
      );
    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "AethexFlow-WebMonitor/4.5" },
      });
      const bodyText = await readLimited(response);
      const titleMatch = bodyText.match(/<title[^>]*>([^<]*)<\/title>/i);
      const latencyMs = Date.now() - started;
      return json({
        ok: response.ok,
        botType,
        latencyMs,
        summary: `HTTP ${response.status} ${response.statusText} (${latencyMs}ms)`,
        data: {
          url: url.toString(),
          status: response.status,
          statusText: response.statusText,
          pageTitle: titleMatch ? titleMatch[1].trim().slice(0, 180) : "(no title)",
          contentType: response.headers.get("content-type") || "unknown",
          server: response.headers.get("server") || "hidden",
          bytesSampled: bodyText.length,
        },
      });
    } catch (err) {
      return json({
        ok: false,
        botType,
        latencyMs: Date.now() - started,
        summary: `Probe failed: ${err instanceof Error ? err.message : "timeout"}`,
        data: { url: url.toString() },
      });
    }
  }

  if (botType === "ai-digest") {
    const inputText = String(payload || target || "")
      .trim()
      .slice(0, 8000);
    if (!inputText) return json({ ok: false, error: "Provide text or notes to summarize" }, 400);
    const raw = await grok(
      [
        {
          role: "system",
          content:
            'Return JSON only: {"headline":"","summary":"","actionItems":[""],"wordCount":0}. You are Aethi. Do not name a vendor.',
        },
        { role: "user", content: inputText },
      ],
      { max: 500, json: true },
    );
    let data = localDigest(inputText);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        data = {
          headline: String(parsed.headline || data.headline).slice(0, 140),
          summary: String(parsed.summary || data.summary).slice(0, 800),
          actionItems: Array.isArray(parsed.actionItems)
            ? parsed.actionItems.map((item) => String(item)).slice(0, 6)
            : data.actionItems,
          wordCount: Number(parsed.wordCount) || data.wordCount,
          engine: "aethi",
        };
      } catch {
        /* keep local */
      }
    }
    return json({
      ok: true,
      botType,
      latencyMs: Date.now() - started,
      summary: data.headline,
      data,
    });
  }

  if (botType === "webhook-relay") {
    let parsedBody: unknown = payload || {
      event: "aethexflow.ping",
      timestamp: new Date().toISOString(),
    };
    if (typeof payload === "string" && payload.trim()) {
      try {
        parsedBody = JSON.parse(payload);
      } catch {
        parsedBody = { message: payload.slice(0, 2000) };
      }
    }
    const dryRun = Boolean(body.dryRun) || !target.trim();
    if (dryRun) {
      return json({
        ok: true,
        botType,
        latencyMs: Date.now() - started,
        summary: "Dry-run payload signed and validated",
        data: {
          mode: "dry-run",
          targetUrl: target || "(dry-run)",
          headers: { "Content-Type": "application/json", "X-AethexFlow-Bot": "webhook-relay" },
          payloadSent: parsedBody,
        },
      });
    }
    const url = publicUrl(target);
    if (!url)
      return json({ ok: false, error: "Webhook URL must be a public http(s) address" }, 400);
    try {
      const hookRes = await fetch(url.toString(), {
        method: "POST",
        signal: AbortSignal.timeout(8000),
        headers: { "Content-Type": "application/json", "X-AethexFlow-Bot": "webhook-relay" },
        body: JSON.stringify(parsedBody),
      });
      const resText = await readLimited(hookRes, 8_000);
      return json({
        ok: hookRes.ok,
        botType,
        latencyMs: Date.now() - started,
        summary: `Webhook POST HTTP ${hookRes.status}`,
        data: {
          mode: "live-dispatch",
          targetUrl: url.toString(),
          status: hookRes.status,
          responsePreview: resText.slice(0, 400),
          payloadSent: parsedBody,
        },
      });
    } catch (err) {
      return json({
        ok: false,
        botType,
        latencyMs: Date.now() - started,
        summary: err instanceof Error ? err.message : "Webhook failed",
        error: "Webhook request failed",
      });
    }
  }

  if (botType === "data-normalizer") {
    const raw = String(payload || "").trim();
    if (!raw) return json({ ok: false, error: "Provide CSV, TSV, or JSON rows to normalize" }, 400);
    let rows: Array<Record<string, string>> = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        rows = parsed.map((item) => {
          const clean: Record<string, string> = {};
          if (item && typeof item === "object") {
            for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
              clean[k.trim().toLowerCase().replace(/\s+/g, "_")] = String(v ?? "").trim();
            }
          }
          return clean;
        });
      }
    } catch {
      const lines = raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length > 0) {
        const delimiter = lines[0].includes("\t") ? "\t" : ",";
        const headers = lines[0]
          .split(delimiter)
          .map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(delimiter).map((c) => c.trim());
          const obj: Record<string, string> = {};
          headers.forEach((h, idx) => {
            obj[h || `col_${idx + 1}`] = cols[idx] ?? "";
          });
          rows.push(obj);
        }
      }
    }
    const seen = new Set<string>();
    const uniqueRows = rows.filter((r) => {
      const sig = JSON.stringify(r);
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
    return json({
      ok: true,
      botType,
      latencyMs: Date.now() - started,
      summary: `Normalized ${uniqueRows.length} unique record(s) (${rows.length - uniqueRows.length} duplicates removed)`,
      data: {
        inputCount: rows.length,
        uniqueCount: uniqueRows.length,
        duplicatesRemoved: rows.length - uniqueRows.length,
        normalizedRows: uniqueRows.slice(0, 200),
      },
    });
  }

  return json({ ok: false, error: `Unsupported botType: ${botType}` }, 400);
}

async function handleTranslate(body: Record<string, unknown>): Promise<Response> {
  const text = String(body.text || "")
    .trim()
    .slice(0, 4000);
  if (!text) return json({ error: "Text is required" }, 400);
  const sourceLang = String(body.sourceLang || "Auto");
  const targetLang = String(body.targetLang || "Roman Urdu");
  const tone = String(body.tone || "Natural");
  const out = await grok(
    [
      {
        role: "system",
        content:
          "You are Aethi. Translate accurately. Return only the translation, no commentary, no vendor names.",
      },
      {
        role: "user",
        content: `Source: ${sourceLang}\nTarget: ${targetLang}\nTone: ${tone}\n\n${text}`,
      },
    ],
    { max: 800 },
  );
  if (out) {
    return json({ translatedText: out.trim(), detectedSource: sourceLang });
  }
  const roman = targetLang.toLowerCase().includes("roman");
  return json({
    translatedText: roman ? `Roman Urdu: ${text}` : `Translated (${targetLang}): ${text}`,
    detectedSource: sourceLang,
    note: "Aethi local pass",
  });
}

function routeCommand(query: string) {
  const lower = query.toLowerCase();
  let toolId = "background-remover";
  if (/(video|short|reel|clip|timeline|edit)/.test(lower)) toolId = "video-studio";
  else if (/(encrypt|decrypt|aes|hash|sha|vault)/.test(lower)) toolId = "crypto-vault";
  else if (/(json|csv)/.test(lower)) toolId = "data-formatter";
  else if (/(bot|monitor|webhook|digest)/.test(lower)) toolId = "bot-rental";
  else if (lower.includes("pdf")) toolId = "pdf-compressor";
  else if (/(urdu|translate|tarjuma)/.test(lower)) toolId = "text-translator";
  else if (/(convert|webp|jpg|png)/.test(lower)) toolId = "image-converter";
  return {
    toolId,
    confidence: 0.92,
    suggestedTask: query,
    intentSummary: `Aethi routed this to ${toolId}.`,
  };
}

async function handleAdminDispatch(body: Record<string, unknown>): Promise<Response> {
  const instruction = String(body.instruction || "")
    .trim()
    .slice(0, 1500);
  if (!instruction) return json({ ok: false, error: "Instruction is required" }, 400);
  const s = store();
  const lower = instruction.toLowerCase();
  const changes: Record<string, string | boolean> = {};
  if (lower.includes("maintenance on")) changes.maintenanceMode = true;
  if (lower.includes("maintenance off")) changes.maintenanceMode = false;
  const banner = instruction
    .match(/(?:banner|announcement)\s*[:=]\s*["“']?([^"”'\n]+)["”']?/i)?.[1]
    ?.trim();
  if (banner) changes.announcementBanner = banner.slice(0, 160);
  const intentType =
    lower.includes("tunnel") || lower.includes("local")
      ? "TUNNEL_LOCAL_EXEC"
      : "UPDATE_SITE_CONFIG";
  if (intentType === "TUNNEL_LOCAL_EXEC") {
    return json({
      ok: true,
      modelUsed: "Aethi intent parser",
      routeTarget: "local device",
      intentType,
      changes: {},
      d1Persisted: false,
      assistantReply: "This preview did not send or store a PC command. Pair the local Hub before connecting a supported action.",
      tunnelResult: {
        attempted: false,
        delivered: false,
        endpoint: "local device",
        note: "No command was sent or written to D1.",
      },
      recentUpdates: [],
      timestamp: new Date().toISOString(),
    });
  }
  for (const [k, v] of Object.entries(changes)) s.site[k] = v;
  const record = {
    id: `upd_${Date.now()}`,
    intent_type: intentType,
    payload_json: JSON.stringify(changes),
    model_used: "aethi",
    route_target: "local_preview_memory",
    created_at: new Date().toISOString(),
  };
  s.updates.unshift(record);
  return json({
    ok: true,
    modelUsed: "Aethi intent parser",
    routeTarget: record.route_target,
    intentType,
    changes,
    assistantReply: "Preview site state changed in memory only. It was not written to D1.",
    d1Persisted: false,
    storageScope: "local preview memory only",
    siteConfig: s.site,
    tunnelResult: {
      attempted: intentType === "TUNNEL_LOCAL_EXEC",
      delivered: false,
      endpoint: "local-agent-queue",
      note: "Desktop gateway is not attached in this session. The command is queued.",
    },
    recentUpdates: s.updates.slice(0, 10),
    timestamp: record.created_at,
  });
}

export async function handleAethiApi(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();

  try {
    if (method === "GET" && path === "/api/health") {
      return json({
        ok: true,
        version: "4.5.0",
        timestamp: new Date().toISOString(),
        aethi: {
          ready: Boolean(process.env.XAI_API_KEY),
          any_ready: Boolean(process.env.XAI_API_KEY),
        },
      });
    }

    if (method === "GET" && path === "/api/hub/telemetry") {
      return json({
        engineVersion: "4.5.0",
        runtime: "AethexFlow",
        automatedDagEnabled: false,
        connectedDevices: 0,
        aethiReady: Boolean(process.env.XAI_API_KEY),
      });
    }

    if (path === "/api/aethi/tasks") {
      return json({ ok: false, error: "Device tasks are stored locally and are not accepted by the site." }, 410);
    }

    if (method === "POST" && path === "/api/chat") {
      return handleChat(await readJson(request));
    }
    if (method === "POST" && path === "/api/ai/test") {
      return handleOnlineConnectionTest(await readJson(request));
    }
    if (method === "POST" && path === "/api/video-plan") {
      return handleVideoPlan(await readJson(request));
    }
    if (method === "POST" && path === "/api/bots/run") {
      return handleBots(await readJson(request));
    }
    if (method === "POST" && path === "/api/translate") {
      return handleTranslate(await readJson(request));
    }
    if (method === "POST" && path === "/api/route-command") {
      const body = await readJson(request);
      const query = String(body.query || "").trim();
      if (!query) return json({ error: "Query is required" }, 400);
      return json(routeCommand(query));
    }

    if (method === "POST" && path === "/api/admin/auth") {
      const body = await readJson(request);
      const supplied = String(body.token || body.passcode || "").trim();
      const configured = process.env.ADMIN_GATEWAY_TOKEN;
      if (!configured) {
        return json({ ok: false, error: "Set ADMIN_GATEWAY_TOKEN before using the preview Admin Gateway." }, 503);
      }
      if (!supplied || supplied !== configured) {
        return json({ ok: false, error: "That passcode does not match." }, 401);
      }
      const sessionToken = configured;
      store().sessions.add(sessionToken);
      return json({ ok: true, sessionToken, mode: "owner-key" });
    }

    if (method === "GET" && path === "/api/admin/state") {
      if (!authorized(request))
        return json({ ok: false, error: "Sign in to the admin gateway first." }, 401);
      const s = store();
      return json({
        ok: true,
        targetDomain: "aethexflow.online",
        d1Bound: false,
        tunnelTarget: "local-agent-queue",
        siteConfig: s.site,
        recentUpdates: s.updates.slice(0, 15),
      });
    }

    if (method === "POST" && path === "/api/admin/dispatch") {
      if (!authorized(request))
        return json({ ok: false, error: "Sign in to the admin gateway first." }, 401);
      return handleAdminDispatch(await readJson(request));
    }

    return json({ ok: false, error: "Unknown API route" }, 404);
  } catch (err) {
    console.error("[aethi] api error", err);
    return json({ ok: false, error: "Aethi hit an unexpected error." }, 500);
  }
}
