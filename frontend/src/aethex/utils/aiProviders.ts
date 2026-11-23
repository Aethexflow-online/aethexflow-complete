export type AIConnectionMode = "workspace" | "local" | "online";

export type OnlineProviderId =
  "openai" | "openrouter" | "groq" | "together" | "fireworks" | "deepseek" | "mistral" | "xai";

export interface AIConnectionSettings {
  mode: AIConnectionMode;
  localUrl: string;
  localModel: string;
  onlineProvider: OnlineProviderId;
  onlineModel: string;
}

export const ONLINE_PROVIDERS: Array<{
  id: OnlineProviderId;
  label: string;
  modelHint: string;
}> = [
  { id: "openai", label: "OpenAI", modelHint: "gpt-4o-mini" },
  { id: "openrouter", label: "OpenRouter", modelHint: "openai/gpt-4o-mini" },
  { id: "groq", label: "Groq", modelHint: "llama-3.3-70b-versatile" },
  { id: "together", label: "Together AI", modelHint: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
  {
    id: "fireworks",
    label: "Fireworks AI",
    modelHint: "accounts/fireworks/models/llama-v3p3-70b-instruct",
  },
  { id: "deepseek", label: "DeepSeek", modelHint: "deepseek-chat" },
  { id: "mistral", label: "Mistral AI", modelHint: "mistral-small-latest" },
  { id: "xai", label: "xAI", modelHint: "grok-3-mini" },
];

const SETTINGS_KEY = "aethexflow.ai-connection.v1";
let onlineApiKeyInMemory = "";

const DEFAULT_SETTINGS: AIConnectionSettings = {
  mode: "workspace",
  localUrl: "http://localhost:11434/v1",
  localModel: "llama3.2",
  onlineProvider: "openai",
  onlineModel: "gpt-4o-mini",
};

export function readAIConnectionSettings(): AIConnectionSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AIConnectionSettings>;
    return {
      mode:
        parsed.mode === "local" || parsed.mode === "online" || parsed.mode === "workspace"
          ? parsed.mode
          : DEFAULT_SETTINGS.mode,
      localUrl: typeof parsed.localUrl === "string" ? parsed.localUrl : DEFAULT_SETTINGS.localUrl,
      localModel:
        typeof parsed.localModel === "string" ? parsed.localModel : DEFAULT_SETTINGS.localModel,
      onlineProvider: ONLINE_PROVIDERS.some((provider) => provider.id === parsed.onlineProvider)
        ? (parsed.onlineProvider as OnlineProviderId)
        : DEFAULT_SETTINGS.onlineProvider,
      onlineModel:
        typeof parsed.onlineModel === "string" ? parsed.onlineModel : DEFAULT_SETTINGS.onlineModel,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAIConnectionSettings(settings: AIConnectionSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function setOnlineAPIKeyInMemory(apiKey: string): void {
  onlineApiKeyInMemory = apiKey.trim();
}

export function getOnlineAPIKeyInMemory(): string {
  return onlineApiKeyInMemory;
}

export function hasOnlineAPIKeyInMemory(): boolean {
  return Boolean(onlineApiKeyInMemory);
}

export function clearOnlineAPIKeyInMemory(): void {
  onlineApiKeyInMemory = "";
}

export function normalizeLocalOllamaUrl(raw: string): string {
  const url = new URL(raw.trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Use an http or https address for your local model.");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error("For privacy, the local model address must point to this device.");
  }
  const cleanPath = url.pathname.replace(/\/+$/, "");
  const path = cleanPath.endsWith("/v1") ? cleanPath : `${cleanPath}/v1`;
  return `${url.origin}${path}`;
}
