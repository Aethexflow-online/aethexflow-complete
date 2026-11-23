import React, { useState } from "react";
import {
  Shield,
  Key,
  RefreshCw,
  Activity,
  Check,
  Zap,
  Bot,
  Cpu,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";
import {
  calculateHubLatency,
  checkLocalHub,
  disconnectLocalHub,
  pairLocalHub,
  validateHubPairCode,
} from "../utils/localHub";
import {
  clearOnlineAPIKeyInMemory,
  getOnlineAPIKeyInMemory,
  hasOnlineAPIKeyInMemory,
  normalizeLocalOllamaUrl,
  ONLINE_PROVIDERS,
  readAIConnectionSettings,
  saveAIConnectionSettings,
  setOnlineAPIKeyInMemory,
  type AIConnectionSettings,
} from "../utils/aiProviders";

interface SettingsAndSecurityProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onLogActivity?: (action: string) => void;
}

export const SettingsAndSecurity: React.FC<SettingsAndSecurityProps> = ({
  theme,
  onToggleTheme,
  onLogActivity,
}) => {
  const isDark = theme === "dark";

  // General preferences
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [showLeftSidebar, setShowLeftSidebar] = useState<boolean>(true);
  const [showRightGuide, setShowRightGuide] = useState<boolean>(true);
  const [prefSavedToast, setPrefSavedToast] = useState<boolean>(false);

  // Local Hub Pairing state
  const [hubCode, setHubCode] = useState<string>("");
  const [hubStatus, setHubStatus] = useState<
    "Checking..." | "Hub online" | "Connected" | "Disconnected"
  >("Checking...");
  const [hubToken, setHubToken] = useState<string | null>(null);
  const [hubError, setHubError] = useState<string | null>(null);
  const [ipcLatency, setIpcLatency] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [aiSettings, setAISettings] = useState<AIConnectionSettings>(() =>
    readAIConnectionSettings(),
  );
  const [aiApiKey, setAIApiKey] = useState("");
  const [hasSavedAIKey, setHasSavedAIKey] = useState(() => hasOnlineAPIKeyInMemory());
  const [showAIKey, setShowAIKey] = useState(false);
  const [aiConnectionStatus, setAIConnectionStatus] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [isTestingAI, setIsTestingAI] = useState(false);

  // Security Vault state
  const [verificationStatus] = useState("Not configured");

  React.useEffect(() => {
    let active = true;
    checkLocalHub()
      .then((health) => {
        if (active) setHubStatus(health.status === "online" ? "Hub online" : "Disconnected");
      })
      .catch(() => {
        if (active) setHubStatus("Disconnected");
      });
    return () => {
      active = false;
    };
  }, []);

  const handlePair = async () => {
    setHubError(null);
    setHubStatus("Checking...");

    const validation = validateHubPairCode(hubCode);
    if (!validation.valid) {
      setHubStatus("Disconnected");
      setHubError(validation.error || "Invalid code");
      return;
    }

    try {
      const result = await pairLocalHub(hubCode.trim());
      setHubToken(result.token);
      setHubStatus("Connected");
      setHubError(null);
      onLogActivity?.("Paired browser with the local Aethi Hub");
    } catch (error) {
      setHubStatus("Disconnected");
      setHubError(error instanceof Error ? error.message : "Could not pair with the local Hub.");
    }
  };

  const handleDisconnect = async () => {
    if (!hubToken) {
      setHubStatus("Disconnected");
      return;
    }
    try {
      await disconnectLocalHub(hubToken);
      setHubToken(null);
      setHubStatus("Hub online");
      setHubError(null);
      onLogActivity?.("Disconnected local Aethi Hub session");
    } catch (error) {
      setHubError(error instanceof Error ? error.message : "Could not disconnect from the local Hub.");
    }
  };

  const testIpcPing = async () => {
    setIsPinging(true);
    const startedAt = performance.now();
    try {
      await checkLocalHub();
      const ping = Math.round(performance.now() - startedAt);
      setIpcLatency(ping);
      setHubError(null);
      onLogActivity?.(`Local Hub responded in ${ping}ms`);
    } catch (error) {
      setHubStatus("Disconnected");
      setHubToken(null);
      setHubError(error instanceof Error ? error.message : "The local Hub did not respond.");
    } finally {
      setIsPinging(false);
    }
  };

  const savePreferences = () => {
    setPrefSavedToast(true);
    setTimeout(() => setPrefSavedToast(false), 2500);
    onLogActivity?.("Saved workspace display preferences");
  };

  const resetPreferences = () => {
    setDensity("comfortable");
    setShowLeftSidebar(true);
    setShowRightGuide(true);
  };

  const latencyStatus = ipcLatency === null ? null : calculateHubLatency(ipcLatency);

  const saveAISettings = () => {
    saveAIConnectionSettings(aiSettings);
    if (aiApiKey.trim()) {
      setOnlineAPIKeyInMemory(aiApiKey);
      setAIApiKey("");
      setHasSavedAIKey(true);
    }
    setAIConnectionStatus({
      type: "success",
      message: "AI connection preferences saved in this browser.",
    });
    onLogActivity?.(`Saved AI connection mode: ${aiSettings.mode}`);
  };

  const clearAIKey = () => {
    clearOnlineAPIKeyInMemory();
    setAIApiKey("");
    setHasSavedAIKey(false);
    setAIConnectionStatus({
      type: "info",
      message: "The online API key was cleared from this tab.",
    });
  };

  const testAIConnection = async () => {
    setIsTestingAI(true);
    setAIConnectionStatus(null);
    try {
      if (aiSettings.mode === "local") {
        const baseUrl = normalizeLocalOllamaUrl(aiSettings.localUrl);
        const response = await fetch(`${baseUrl}/models`, { method: "GET" });
        if (!response.ok) throw new Error(`Local model service responded with ${response.status}.`);
        const body = (await response.json().catch(() => ({}))) as {
          data?: Array<{ id?: string }>;
          models?: Array<{ name?: string }>;
        };
        const models =
          body.data?.map((item) => item.id).filter(Boolean) ||
          body.models?.map((item) => item.name).filter(Boolean) ||
          [];
        const modelMessage =
          models.length > 0
            ? `Connected. Available model${models.length === 1 ? "" : "s"}: ${models.slice(0, 4).join(", ")}${models.length > 4 ? "…" : ""}`
            : "Connected to the local model service.";
        setAIConnectionStatus({ type: "success", message: modelMessage });
      } else if (aiSettings.mode === "online") {
        const key = aiApiKey.trim() || getOnlineAPIKeyInMemory();
        if (!key) throw new Error("Add your provider API key before testing this connection.");
        const response = await fetch("/api/ai/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            connection: {
              providerId: aiSettings.onlineProvider,
              apiKey: key,
              model: aiSettings.onlineModel,
            },
          }),
        });
        const result = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (!response.ok || !result.ok)
          throw new Error(result.error || "The online connection could not be verified.");
        setAIConnectionStatus({
          type: "success",
          message: "Connected. Your key was accepted by the selected provider.",
        });
      } else {
        const response = await fetch("/api/health");
        const result = (await response.json().catch(() => ({}))) as {
          aethi?: { ready?: boolean };
        };
        setAIConnectionStatus({
          type: result.aethi?.ready ? "success" : "info",
          message: result.aethi?.ready
            ? "The workspace AI service is ready."
            : "The workspace AI service is not configured; local replies are available until it is.",
        });
      }
    } catch (error) {
      setAIConnectionStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Could not test the AI connection.",
      });
    } finally {
      setIsTestingAI(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1
            className={`text-2xl font-black tracking-tight ${isDark ? "text-white" : "text-neutral-900"}`}
          >
            Settings & Security
          </h1>
          <p className={`text-xs ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
            Control local automation daemon, zero-trust hardware keys, and workspace display.
          </p>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          className="px-3.5 py-1.5 rounded-xl border border-red-500/30 bg-red-600/10 hover:bg-red-600/20 text-red-500 font-semibold text-xs transition-all flex items-center gap-2"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Theme: {isDark ? "Obsidian & Crimson Glass" : "Studio Light Glass"}</span>
        </button>
      </div>

      {/* AI PROVIDER CONNECTIONS */}
      <div
        className={`p-6 rounded-2xl border ${
          isDark ? "bg-[#12141c]/90 border-neutral-800" : "bg-white border-neutral-200 shadow-sm"
        }`}
      >
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-base font-bold ${isDark ? "text-white" : "text-neutral-900"}`}>
              AI connections
            </h2>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              Choose the built-in service, a model running on this device, or an online provider
              using your own key.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          {[
            { id: "workspace", icon: Bot, title: "Workspace AI", detail: "Built-in service" },
            { id: "local", icon: Cpu, title: "Local model", detail: "Ollama on this device" },
            { id: "online", icon: Globe, title: "Online provider", detail: "Use your own API key" },
          ].map((option) => {
            const Icon = option.icon;
            const selected = aiSettings.mode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setAISettings((current) => ({
                    ...current,
                    mode: option.id as AIConnectionSettings["mode"],
                  }));
                  setAIConnectionStatus(null);
                }}
                aria-pressed={selected}
                className={`min-h-16 rounded-xl border px-3 py-3 text-left transition-colors ${
                  selected
                    ? "border-red-500/60 bg-red-500/10"
                    : isDark
                      ? "border-neutral-800 bg-neutral-900/40 hover:border-neutral-700"
                      : "border-neutral-200 bg-neutral-50 hover:border-neutral-300"
                }`}
              >
                <span
                  className={`flex items-center gap-2 text-xs font-bold ${isDark ? "text-neutral-100" : "text-neutral-900"}`}
                >
                  <Icon className={`w-4 h-4 ${selected ? "text-red-500" : "text-neutral-400"}`} />
                  {option.title}
                </span>
                <span className="block text-[11px] text-neutral-400 mt-1 pl-6">
                  {option.detail}
                </span>
              </button>
            );
          })}
        </div>

        {aiSettings.mode === "local" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="ai-local-url"
                  className="text-xs font-semibold text-neutral-400 block"
                >
                  Local Ollama address
                </label>
                <input
                  id="ai-local-url"
                  type="url"
                  value={aiSettings.localUrl}
                  onChange={(event) =>
                    setAISettings((current) => ({ ...current, localUrl: event.target.value }))
                  }
                  placeholder="http://localhost:11434/v1"
                  className={`w-full px-3 py-2.5 rounded-xl border text-xs focus:border-red-500 focus:outline-none ${
                    isDark
                      ? "border-neutral-800 bg-neutral-900/80 text-white"
                      : "border-neutral-200 bg-neutral-50 text-neutral-900"
                  }`}
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="ai-local-model"
                  className="text-xs font-semibold text-neutral-400 block"
                >
                  Model name
                </label>
                <input
                  id="ai-local-model"
                  value={aiSettings.localModel}
                  onChange={(event) =>
                    setAISettings((current) => ({ ...current, localModel: event.target.value }))
                  }
                  placeholder="llama3.2"
                  className={`w-full px-3 py-2.5 rounded-xl border text-xs focus:border-red-500 focus:outline-none ${
                    isDark
                      ? "border-neutral-800 bg-neutral-900/80 text-white"
                      : "border-neutral-200 bg-neutral-50 text-neutral-900"
                  }`}
                />
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-neutral-400">
              Requires Ollama running on this same device. If the app is opened from another device
              or a hosted site, allow that site in Ollama’s{" "}
              <span className="font-mono">OLLAMA_ORIGINS</span> setting. Local chats go directly
              from this browser to Ollama.
            </p>
          </div>
        )}

        {aiSettings.mode === "online" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="ai-online-provider"
                  className="text-xs font-semibold text-neutral-400 block"
                >
                  Provider
                </label>
                <select
                  id="ai-online-provider"
                  value={aiSettings.onlineProvider}
                  onChange={(event) => {
                    const provider = ONLINE_PROVIDERS.find(
                      (item) => item.id === event.target.value,
                    );
                    if (provider) {
                      setAISettings((current) => ({
                        ...current,
                        onlineProvider: provider.id,
                        onlineModel: provider.modelHint,
                      }));
                    }
                  }}
                  className={`w-full px-3 py-2.5 rounded-xl border text-xs focus:border-red-500 focus:outline-none ${
                    isDark
                      ? "border-neutral-800 bg-neutral-900/80 text-white"
                      : "border-neutral-200 bg-neutral-50 text-neutral-900"
                  }`}
                >
                  {ONLINE_PROVIDERS.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="ai-online-model"
                  className="text-xs font-semibold text-neutral-400 block"
                >
                  Model name
                </label>
                <input
                  id="ai-online-model"
                  value={aiSettings.onlineModel}
                  onChange={(event) =>
                    setAISettings((current) => ({ ...current, onlineModel: event.target.value }))
                  }
                  placeholder="Model name from your provider"
                  className={`w-full px-3 py-2.5 rounded-xl border text-xs focus:border-red-500 focus:outline-none ${
                    isDark
                      ? "border-neutral-800 bg-neutral-900/80 text-white"
                      : "border-neutral-200 bg-neutral-50 text-neutral-900"
                  }`}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="ai-online-key"
                className="text-xs font-semibold text-neutral-400 block"
              >
                API key
              </label>
              <div className="flex gap-2">
                <input
                  id="ai-online-key"
                  type={showAIKey ? "text" : "password"}
                  autoComplete="off"
                  value={aiApiKey}
                  onChange={(event) => setAIApiKey(event.target.value)}
                  placeholder={
                    hasSavedAIKey
                      ? "Key saved in this tab — enter a new one to replace it"
                      : "Paste your provider API key"
                  }
                  className={`min-w-0 flex-1 px-3 py-2.5 rounded-xl border text-xs focus:border-red-500 focus:outline-none ${
                    isDark
                      ? "border-neutral-800 bg-neutral-900/80 text-white"
                      : "border-neutral-200 bg-neutral-50 text-neutral-900"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowAIKey((visible) => !visible)}
                  aria-label={showAIKey ? "Hide API key" : "Show API key"}
                  className={`px-3 rounded-xl border ${isDark ? "border-neutral-800 text-neutral-400 hover:text-white" : "border-neutral-200 text-neutral-500 hover:text-neutral-900"}`}
                >
                  {showAIKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] leading-relaxed text-neutral-400">
                The key is kept in tab memory only—not in browser storage or AethexFlow’s database.
                It is sent to the app server over HTTPS to call the selected provider. Usage and
                charges follow your provider’s account.
              </p>
              {hasSavedAIKey && (
                <button
                  type="button"
                  onClick={clearAIKey}
                  className="text-[11px] font-semibold text-red-500 hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3 inline mr-1" />
                  Clear key from this tab
                </button>
              )}
            </div>
          </div>
        )}

        {aiSettings.mode === "workspace" && (
          <p className="text-[11px] leading-relaxed text-neutral-400">
            Uses the workspace’s hosted AI service when configured. If it is unavailable, Aethi
            falls back to built-in local replies.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-5">
          <button
            type="button"
            onClick={saveAISettings}
            className="min-h-10 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors flex items-center gap-2"
          >
            <Save className="w-3.5 h-3.5" />
            Save connection
          </button>
          <button
            type="button"
            onClick={testAIConnection}
            disabled={isTestingAI}
            className={`min-h-10 px-4 rounded-xl border font-semibold text-xs transition-colors flex items-center gap-2 ${
              isDark
                ? "border-neutral-700 bg-neutral-900/50 text-neutral-200 hover:bg-neutral-800"
                : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            {isTestingAI ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Test connection
          </button>
        </div>
        {aiConnectionStatus && (
          <p
            role="status"
            className={`mt-3 text-xs font-medium ${
              aiConnectionStatus.type === "error"
                ? "text-red-500"
                : aiConnectionStatus.type === "success"
                  ? "text-emerald-500"
                  : "text-amber-500"
            }`}
          >
            {aiConnectionStatus.message}
          </p>
        )}
      </div>

      {/* General Preferences Card */}
      <div
        className={`p-6 rounded-2xl border ${
          isDark ? "bg-[#12141c]/90 border-neutral-800" : "bg-white border-neutral-200 shadow-sm"
        }`}
      >
        <h2
          className={`font-bold text-sm tracking-tight mb-4 ${isDark ? "text-white" : "text-neutral-900"}`}
        >
          Workspace Preferences
        </h2>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="interface-density"
              className="text-xs font-semibold text-neutral-400 block"
            >
              Interface density
            </label>
            <select
              id="interface-density"
              value={density}
              onChange={(e) => setDensity(e.target.value as "comfortable" | "compact")}
              className={`w-full max-w-xs p-2.5 rounded-xl border text-xs focus:border-red-500 outline-none ${
                isDark
                  ? "border-neutral-800 bg-neutral-900/60 text-white"
                  : "border-neutral-200 bg-neutral-50 text-neutral-900"
              }`}
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </div>

          <div
            className={`p-4 rounded-xl border space-y-3 ${
              isDark
                ? "border-neutral-800/80 bg-neutral-900/30"
                : "border-neutral-200 bg-neutral-50"
            }`}
          >
            <span
              className={`text-xs font-semibold block ${isDark ? "text-neutral-300" : "text-neutral-700"}`}
            >
              Workspace panels
            </span>

            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLeftSidebar}
                  onChange={(e) => setShowLeftSidebar(e.target.checked)}
                  className="rounded accent-red-500"
                />
                <span className={`font-medium ${isDark ? "text-neutral-300" : "text-neutral-700"}`}>
                  Show left navigation sidebar
                </span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showRightGuide}
                  onChange={(e) => setShowRightGuide(e.target.checked)}
                  className="rounded accent-red-500"
                />
                <span className={`font-medium ${isDark ? "text-neutral-300" : "text-neutral-700"}`}>
                  Show right workspace guide
                </span>
              </label>
            </div>

            <p className="text-[11px] text-neutral-400">
              These choices are saved locally and applied across the workspace.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={savePreferences}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 text-white font-semibold text-xs shadow-md shadow-red-950/30 transition-all flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save on this browser</span>
            </button>
            <button
              type="button"
              onClick={resetPreferences}
              className={`px-4 py-2 rounded-xl border font-semibold text-xs transition-all ${
                isDark
                  ? "border-neutral-800 bg-neutral-900/40 hover:bg-neutral-800 text-neutral-300"
                  : "border-neutral-200 bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
              }`}
            >
              Reset
            </button>
          </div>

          {prefSavedToast && (
            <p className="text-xs text-emerald-500 font-medium animate-in fade-in">
              Saved on this browser. Preferences apply across AethexFlow pages in this browser.
            </p>
          )}
        </div>
      </div>

      {/* LOCAL AUTOMATION */}
      <div
        className={`p-6 rounded-2xl border ${
          isDark
            ? "bg-gradient-to-br from-[#15121b] via-[#12141c] to-[#0d0e14] border-red-500/30"
            : "bg-white border-red-200 shadow-sm"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-red-500 font-bold">
            Local Automation
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              hubStatus === "Connected"
                ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                : hubStatus === "Checking..."
                  ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                  : "bg-neutral-800 text-neutral-400"
            }`}
          >
            {hubStatus}
          </span>
        </div>

        <h2 className={`text-lg font-black mb-1 ${isDark ? "text-white" : "text-neutral-900"}`}>
          Connect Local Hub
        </h2>
        <p
          className={`text-xs mb-5 leading-relaxed ${isDark ? "text-neutral-300" : "text-neutral-600"}`}
        >
          Pair this browser with{" "}
          <span className="font-mono text-red-500">cloudflared / 127.0.1.1:251</span> local gateway.
          Automation stays on your device.
        </p>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="hub-pair-code" className="text-xs font-semibold text-neutral-400 block">
              6-digit code from Hub
            </label>
            <input
              id="hub-pair-code"
              type="text"
              maxLength={6}
              value={hubCode}
              onChange={(e) => setHubCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit code from Hub"
              className={`w-full max-w-md px-4 py-2.5 rounded-xl border font-mono text-sm tracking-wider focus:border-red-500 focus:outline-none transition-all ${
                isDark
                  ? "border-neutral-800 bg-neutral-900/80 text-white placeholder-neutral-500"
                  : "border-neutral-200 bg-neutral-50 text-neutral-900 placeholder-neutral-400"
              }`}
            />
            {hubError && <p className="text-xs text-red-500 font-medium">{hubError}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handlePair}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 text-white font-bold text-xs shadow-md shadow-red-950/30 transition-all"
            >
              Pair
            </button>

            <button
              type="button"
              onClick={handleDisconnect}
              className={`px-5 py-2.5 rounded-xl border font-bold text-xs transition-all ${
                isDark
                  ? "border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800 text-neutral-400 hover:text-white"
                  : "border-neutral-200 bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
              }`}
            >
              Disconnect
            </button>

            {hubToken && hubStatus === "Connected" && (
              <button
                type="button"
                onClick={testIpcPing}
                disabled={isPinging}
                className="px-4 py-2.5 rounded-xl border border-red-500/20 bg-red-950/20 hover:bg-red-900/30 text-red-500 font-semibold text-xs transition-all flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? "animate-spin" : ""}`} />
                <span>
                  {ipcLatency === null
                    ? "Test Gateway Ping"
                    : `Test Gateway Ping (${ipcLatency}ms • ${latencyStatus?.statusText})`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Zero-Trust Hardware Vault & Tamper Seal Section */}
      <div
        className={`p-6 rounded-2xl border ${
          isDark ? "bg-[#12141c]/90 border-neutral-800" : "bg-white border-neutral-200 shadow-sm"
        }`}
      >
        <div className="flex items-center gap-2.5 mb-2">
          <Shield className="w-5 h-5 text-red-500" />
          <h2 className={`text-base font-bold ${isDark ? "text-white" : "text-neutral-900"}`}>
            Encryption & Device Verification
          </h2>
        </div>
        <p className="text-xs text-neutral-400 mb-5 leading-relaxed">
          Encryption uses browser WebCrypto with PBKDF2 and AES-256-GCM. Biometric checks and
          Ed25519 artifact verification are not configured in this build.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            className={`p-4 rounded-xl border space-y-3 ${
              isDark ? "border-neutral-800 bg-neutral-900/40" : "border-neutral-200 bg-neutral-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-bold ${isDark ? "text-neutral-200" : "text-neutral-800"}`}
              >
                Device Biometric Gate
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-400 border border-neutral-700">
                {verificationStatus}
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Hardware keystore verification is not connected to this workspace.
            </p>
          </div>

          <div
            className={`p-4 rounded-xl border space-y-3 ${
              isDark ? "border-neutral-800 bg-neutral-900/40" : "border-neutral-200 bg-neutral-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-bold ${isDark ? "text-neutral-200" : "text-neutral-800"}`}
              >
                Ed25519 Digital Tamper Seal
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-400 border border-neutral-700">
                Not verified
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              No signing key or verification key is configured, so artifact integrity is not checked.
            </p>
            <div
              className={`font-mono text-[10px] p-2 rounded truncate border ${
                isDark
                  ? "bg-neutral-950/80 text-neutral-400 border-neutral-800"
                  : "bg-white text-neutral-600 border-neutral-200"
              }`}
            >
              Ed25519 verification unavailable
            </div>
          </div>
        </div>
      </div>

      {/* System Diagnostics */}
      <div
        className={`p-6 rounded-2xl border ${
          isDark ? "bg-[#12141c]/90 border-neutral-800" : "bg-white border-neutral-200 shadow-sm"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2
              className={`text-base font-bold flex items-center gap-2 ${isDark ? "text-white" : "text-neutral-900"}`}
            >
              <Activity className="w-4 h-4 text-red-500" />
              System Diagnostics & Administrative Console
            </h2>
            <p className="text-xs text-neutral-400">
              Access the unindexed Master Control Vault for bot fleet quotas and Cloudflare
              diagnostics.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.hash = "#control-vault-master";
            }}
            className="px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-950/30 hover:bg-red-900/40 text-red-400 hover:text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 shrink-0"
          >
            <Key className="w-4 h-4" />
            <span>Open Master Vault</span>
          </button>
        </div>
      </div>
    </div>
  );
};
