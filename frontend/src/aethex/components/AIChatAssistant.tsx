/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Send,
  Bot,
  User,
  RefreshCw,
  ArrowRight,
  Paperclip,
  Mic,
  MicOff,
  Volume2,
  Square,
  X,
  FileText,
  Sparkles,
  Loader2,
  UploadCloud,
  Trash2,
} from "lucide-react";
import {
  getOnlineAPIKeyInMemory,
  normalizeLocalOllamaUrl,
  ONLINE_PROVIDERS,
  readAIConnectionSettings,
} from "../utils/aiProviders";

interface AttachedFile {
  id: string;
  name: string;
  mimeType: string;
  base64: string;
  previewUrl?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  suggestedTool?: string;
  files?: Array<{ name: string; previewUrl?: string }>;
  isTyped?: boolean;
}

const CHAT_HISTORY_KEY = "aethexflow.chat-history.v1";
const MAX_STORED_MESSAGES = 250;

interface AIChatAssistantProps {
  theme: "dark" | "light";
  onOpenTool: (id: string) => void;
  onLogActivity?: (action: string) => void;
  operatorName?: string;
  brandName?: string;
  initialPrompt?: string;
  onClearInitialPrompt?: () => void;
}

const AETHI_LOCAL_SYSTEM =
  "You are Aethi, the assistant inside AethexFlow. Help people use its tools and answer general questions clearly and safely. Be concise and practical. Reply in the language the user used, including Urdu or Roman Urdu when appropriate. Do not claim a local desktop action has run unless a connected tool actually did it.";

function extractProviderReply(data: any): string {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        part && typeof part === "object" && typeof part.text === "string" ? part.text : "",
      )
      .join("")
      .trim();
  }
  return "";
}

const TypewriterMessage: React.FC<{ content: string; onComplete?: () => void }> = ({
  content,
  onComplete,
}) => {
  const [displayed, setDisplayed] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < content.length) {
      const timer = setTimeout(() => {
        setDisplayed((prev) => prev + content[index]);
        setIndex((prev) => prev + 1);
      }, 10);
      return () => clearTimeout(timer);
    } else {
      onComplete?.();
    }
  }, [index, content]);

  return <span className="whitespace-pre-wrap">{displayed}</span>;
};

export const AIChatAssistant: React.FC<AIChatAssistantProps> = ({
  theme,
  onOpenTool,
  onLogActivity,
  operatorName = "Muhammad Shehroz",
  brandName = "AethexFlow",
  initialPrompt,
  onClearInitialPrompt,
}) => {
  const isDark = theme === "dark";
  const aiConnection = readAIConnectionSettings();

  const makeWelcomeMessage = (): ChatMessage => ({
      id: "msg_welcome",
      role: "assistant",
      content: `Assalam-o-Alaikum, ${operatorName}. I am Aethi, your ${brandName} assistant.\n\nAvailable here:\n- Video and image editing tools\n- PDF, image, translation, and data utilities\n- Browser-based AES-256-GCM encryption\n- Local Aethi Hub pairing for supported device actions\n\nChat does not execute PC commands. How can I help?`,
      timestamp: "Ready",
      isTyped: true,
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => [makeWelcomeMessage()]);
  const [historyReady, setHistoryReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CHAT_HISTORY_KEY);
      const parsed: unknown = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed)) {
        const valid = parsed.filter(
          (message): message is ChatMessage =>
            message &&
            typeof message === "object" &&
            typeof message.id === "string" &&
            (message.role === "user" || message.role === "assistant") &&
            typeof message.content === "string" &&
            typeof message.timestamp === "string",
        );
        if (valid.length) {
          setMessages(valid.slice(-MAX_STORED_MESSAGES).map((message) => ({
            ...message,
            isTyped: true,
            files: Array.isArray(message.files)
              ? message.files
                  .filter((file) => file && typeof file.name === "string")
                  .map((file) => ({ name: file.name }))
              : undefined,
          })));
        }
      }
    } catch {
      // Corrupt or unavailable browser storage falls back to a fresh chat.
    }
    setHistoryReady(true);
  }, []);

  useEffect(() => {
    if (!historyReady) return;
    try {
      const localOnly = messages.slice(-MAX_STORED_MESSAGES).map((message) => ({
        ...message,
        files: message.files?.map(({ name }) => ({ name })),
      }));
      window.localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(localOnly));
    } catch {
      // Keep the active conversation usable when storage is full or blocked.
    }
  }, [messages, historyReady]);

  const [inputMessage, setInputMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (historyReady && initialPrompt && initialPrompt.trim()) {
      const promptToRun = initialPrompt;
      onClearInitialPrompt?.();
      handleSend(promptToRun);
    }
  }, [initialPrompt, historyReady]);

  const processFiles = (fileList: FileList | File[]) => {
    Array.from(fileList).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        const isImage = file.type.startsWith("image/");
        setAttachments((prev) => [
          ...prev,
          {
            id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: file.name,
            mimeType: file.type || "application/octet-stream",
            base64,
            previewUrl: isImage ? result : undefined,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData?.files?.length) {
      e.preventDefault();
      processFiles(e.clipboardData.files);
    }
  };

  const toggleVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice recognition is supported in Chrome and Edge browsers.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join("");
      setInputMessage(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleSpeak = (msg: ChatMessage) => {
    if (!("speechSynthesis" in window)) return;

    if (speakingMsgId === msg.id) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(msg.content);
    utterance.rate = 1.05;
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
    setSpeakingMsgId(msg.id);
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (textToSend?: string) => {
    const typedText = (textToSend || inputMessage).trim();
    if (!typedText && attachments.length === 0) return;
    if (isLoading) return;

    const currentFiles = [...attachments];
    const text =
      typedText ||
      `Please review the attached file${currentFiles.length === 1 ? "" : "s"} and help me with it.`;
    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: "user",
      content: text || `Attached ${currentFiles.length} file(s)`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      files: currentFiles.map((f) => ({ name: f.name, previewUrl: f.previewUrl })),
      isTyped: true,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setAttachments([]);
    setIsLoading(true);
    onLogActivity?.(`Asked ${brandName} Copilot: "${text.slice(0, 32)}..."`);

    try {
      const historyPayload = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let replyText = "";
      if (aiConnection.mode === "local") {
        if (!aiConnection.localModel.trim())
          throw new Error("Enter a local model name in AI connections first.");
        const baseUrl = normalizeLocalOllamaUrl(aiConnection.localUrl);
        const imageFile = currentFiles.find((file) => file.mimeType.startsWith("image/"));
        const userContent = imageFile
          ? [
              { type: "text", text },
              {
                type: "image_url",
                image_url: { url: `data:${imageFile.mimeType};base64,${imageFile.base64}` },
              },
            ]
          : text;
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: aiConnection.localModel.trim(),
            max_tokens: 700,
            temperature: 0.4,
            messages: [
              { role: "system", content: AETHI_LOCAL_SYSTEM },
              ...historyPayload,
              { role: "user", content: userContent },
            ],
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? "Ollama could not find this model. Check the model name in AI connections."
              : `The local model request failed (${res.status}). Check that Ollama is running and accessible.`,
          );
        }
        replyText = extractProviderReply(data);
        if (!replyText) throw new Error("The local model returned an empty reply.");
      } else {
        const connectionPayload =
          aiConnection.mode === "online"
            ? {
                mode: "online",
                providerId: aiConnection.onlineProvider,
                model: aiConnection.onlineModel,
                apiKey: getOnlineAPIKeyInMemory(),
              }
            : undefined;
        if (aiConnection.mode === "online" && !connectionPayload?.apiKey) {
          throw new Error("Add your online provider API key in Settings → AI connections.");
        }
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: historyPayload,
            attachment: currentFiles[0]
              ? {
                  name: currentFiles[0].name,
                  mimeType: currentFiles[0].mimeType,
                  base64: currentFiles[0].base64,
                }
              : null,
            attachments: currentFiles.map((f) => ({
              name: f.name,
              mimeType: f.mimeType,
              base64: f.base64,
            })),
            brandName,
            operatorName,
            ...(connectionPayload ? { connection: connectionPayload } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            data.error ||
              `Aethi could not answer just now (${res.status}). Try again or choose another AI connection.`,
          );
        }
        replyText =
          data.text || data.reply || "I have processed your request with the AethexFlow engine.";
      }

      let toolSuggestion: string | undefined;
      const lower = (replyText + " " + text).toLowerCase();
      if (
        lower.includes("video") ||
        lower.includes("studio") ||
        lower.includes("timeline") ||
        lower.includes("short")
      ) {
        toolSuggestion = "video-studio";
      } else if (
        lower.includes("background") ||
        lower.includes("cutout") ||
        lower.includes("remove bg")
      ) {
        toolSuggestion = "bg-remover";
      } else if (lower.includes("pdf") || lower.includes("compress")) {
        toolSuggestion = "pdf-compressor";
      } else if (
        lower.includes("encrypt") ||
        lower.includes("aes") ||
        lower.includes("hash") ||
        lower.includes("crypto")
      ) {
        toolSuggestion = "crypto-vault";
      } else if (lower.includes("json") || lower.includes("csv") || lower.includes("format")) {
        toolSuggestion = "data-formatter";
      } else if (
        lower.includes("bot") ||
        lower.includes("webhook") ||
        lower.includes("monitor") ||
        lower.includes("digest")
      ) {
        toolSuggestion = "bot-runner";
      } else if (
        lower.includes("translate") ||
        lower.includes("urdu") ||
        lower.includes("language")
      ) {
        toolSuggestion = "text-translator";
      }

      const botMsg: ChatMessage = {
        id: `bot_${Date.now()}`,
        role: "assistant",
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        suggestedTool: toolSuggestion,
        isTyped: false,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const message =
        err instanceof Error
          ? err.message
          : "Aethi could not reach the selected AI connection just now.";
      console.error("[aethi] chat request failed:", message);
      const fallbackMsg: ChatMessage = {
        id: `bot_${Date.now()}`,
        role: "assistant",
        content: `Aethi could not complete that request. ${message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isTyped: false,
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
      }}
      className="space-y-4 max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col relative animate-in fade-in duration-300"
    >
      {isDragging && (
        <div className="absolute inset-0 z-30 rounded-3xl border-2 border-dashed border-red-500 bg-red-500/10 backdrop-blur-xs flex flex-col items-center justify-center pointer-events-none">
          <UploadCloud className="w-12 h-12 text-red-500 mb-2" />
          <p className="text-base font-bold text-red-600">Drop files to attach to chat</p>
        </div>
      )}

      <div
        className={`flex items-center justify-between pb-3 border-b ${isDark ? "border-neutral-800/80" : "border-neutral-200"}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-rose-600 flex items-center justify-center font-bold text-white shadow-md shadow-red-950/30">
            {brandName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1
              className={`font-bold text-base flex items-center gap-1.5 ${isDark ? "text-white" : "text-neutral-900"}`}
            >
              <span>Aethi — AethexFlow Bot</span>
              <Sparkles className="w-3.5 h-3.5 text-red-500" />
            </h1>
            <p className="text-xs text-neutral-400">
              Multi-tool assistant • Console Typewriter streaming response, drag & drop files, and
              voice input
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-500/10 text-neutral-400 border border-neutral-500/20">
          <span className="w-2 h-2 rounded-full bg-neutral-400"></span>
          {aiConnection.mode === "local"
            ? `Local · ${aiConnection.localModel}`
            : aiConnection.mode === "online"
              ? ONLINE_PROVIDERS.find((provider) => provider.id === aiConnection.onlineProvider)
                  ?.label || "Online AI"
              : "Workspace AI"}
        </span>
        <span className="text-[10px] text-neutral-500 text-right">
          History stays on this device. Workspace/online AI receives recent context and attached files for replies.
        </span>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Clear Aethi chat history saved on this device?")) {
              setMessages([makeWelcomeMessage()]);
            }
          }}
          className="inline-flex items-center gap-1 text-[10px] text-neutral-500 hover:text-red-500 transition-colors"
          aria-label="Clear chat history saved on this device"
        >
          <Trash2 className="w-3 h-3" />
          Clear local history
        </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-500 flex items-center justify-center shrink-0 border border-red-500/30">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? "bg-red-600 text-white rounded-tr-none shadow-md shadow-red-950/30"
                    : isDark
                      ? "bg-[#151722]/90 border border-neutral-800 text-neutral-200 rounded-tl-none shadow-md"
                      : "bg-white border border-neutral-200 text-neutral-800 rounded-tl-none shadow-sm"
                }`}
              >
                {msg.files && msg.files.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2.5">
                    {msg.files.map((f, idx) =>
                      f.previewUrl ? (
                        <img
                          key={idx}
                          src={f.previewUrl}
                          alt={f.name}
                          className="w-24 h-24 object-cover rounded-xl border border-white/20"
                        />
                      ) : (
                        <div
                          key={idx}
                          className="px-2.5 py-1.5 rounded-xl bg-black/15 text-xs font-mono flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{f.name}</span>
                        </div>
                      ),
                    )}
                  </div>
                )}

                <div>
                  {!isUser && !msg.isTyped ? (
                    <TypewriterMessage
                      content={msg.content}
                      onComplete={() => {
                        setMessages((prev) =>
                          prev.map((m) => (m.id === msg.id ? { ...m, isTyped: true } : m)),
                        );
                      }}
                    />
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                </div>

                {msg.suggestedTool && (
                  <div
                    className={`mt-3 pt-2.5 border-t flex items-center justify-between gap-2 ${isDark ? "border-neutral-700/50" : "border-neutral-200"}`}
                  >
                    <span className="text-[11px] text-neutral-400 font-medium">Matching Tool:</span>
                    <button
                      type="button"
                      onClick={() => onOpenTool(msg.suggestedTool!)}
                      className="px-3 py-1 rounded-lg bg-red-600/15 hover:bg-red-600 text-red-500 hover:text-white font-semibold text-xs border border-red-500/30 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>Open Tool</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <div
                  className={`mt-2 flex items-center justify-between gap-4 text-[10px] ${isUser ? "text-white/75" : "text-neutral-500"}`}
                >
                  <span>{msg.timestamp}</span>
                  {!isUser && (
                    <button
                      type="button"
                      onClick={() => handleSpeak(msg)}
                      title="Read aloud"
                      className="flex items-center gap-1 hover:text-red-500 transition-colors cursor-pointer"
                    >
                      {speakingMsgId === msg.id ? (
                        <>
                          <Square className="w-3 h-3 fill-current text-red-500" />
                          <span className="text-red-500 font-semibold">Stop</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Listen</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-lg bg-neutral-800 text-white flex items-center justify-center shrink-0">
                  <User className="w-4 h-4" />
                </div>
              )}
            </motion.div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-500 flex items-center justify-center shrink-0 border border-red-500/30">
              <RefreshCw className="w-4 h-4 animate-spin" />
            </div>
            <div
              className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 ${
                isDark
                  ? "bg-neutral-900/60 border-neutral-800 text-neutral-400"
                  : "bg-white border-neutral-200 text-neutral-600"
              }`}
            >
              <Loader2 className="w-4 h-4 animate-spin text-red-500" />
              <span>Aethi is reasoning and streaming console response...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={() =>
            handleSend("Help me create a 9:16 vertical short in the Video Studio with captions.")
          }
          className={`px-3 py-1.5 rounded-full border transition-all text-[11px] cursor-pointer ${
            isDark
              ? "border-neutral-800 bg-neutral-900/40 hover:border-red-500/30 hover:bg-neutral-800 text-neutral-400 hover:text-white"
              : "border-neutral-200 bg-white hover:border-red-300 text-neutral-600 hover:text-neutral-900"
          }`}
        >
          Vertical Short Video Plan
        </button>
        <button
          type="button"
          onClick={() =>
            handleSend("How can I encrypt sensitive notes using AES-256-GCM in Crypto Vault?")
          }
          className={`px-3 py-1.5 rounded-full border transition-all text-[11px] cursor-pointer ${
            isDark
              ? "border-neutral-800 bg-neutral-900/40 hover:border-red-500/30 hover:bg-neutral-800 text-neutral-400 hover:text-white"
              : "border-neutral-200 bg-white hover:border-red-300 text-neutral-600 hover:text-neutral-900"
          }`}
        >
          AES-256 WebCrypto Vault
        </button>
        <button
          type="button"
          onClick={() =>
            handleSend("How do I compress PDFs locally and monitor endpoints with bots?")
          }
          className={`px-3 py-1.5 rounded-full border transition-all text-[11px] cursor-pointer ${
            isDark
              ? "border-neutral-800 bg-neutral-900/40 hover:border-red-500/30 hover:bg-neutral-800 text-neutral-400 hover:text-white"
              : "border-neutral-200 bg-white hover:border-red-300 text-neutral-600 hover:text-neutral-900"
          }`}
        >
          PDF Compressor & Bots
        </button>
      </div>

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {attachments.map((file) => (
            <div
              key={file.id}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs ${
                isDark
                  ? "bg-neutral-900 border-neutral-700 text-neutral-200"
                  : "bg-white border-neutral-200 text-neutral-800 shadow-2xs"
              }`}
            >
              {file.previewUrl ? (
                <img
                  src={file.previewUrl}
                  alt={file.name}
                  className="w-8 h-8 rounded-lg object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
              )}
              <span className="max-w-32 truncate font-medium">{file.name}</span>
              <button
                type="button"
                onClick={() => setAttachments((prev) => prev.filter((item) => item.id !== file.id))}
                className="p-1 hover:bg-red-500/15 rounded-lg text-neutral-400 hover:text-red-500 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className={`relative flex items-center rounded-2xl border p-1.5 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20 transition-all shadow-inner ${
          isDark ? "border-neutral-800 bg-neutral-900/80" : "border-neutral-200 bg-white"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,text/*,.csv,.json,.md,audio/*,video/*"
          onChange={(e) => {
            if (e.target.files) processFiles(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Attach files or screenshots"
          className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
            isDark
              ? "text-neutral-400 hover:text-white hover:bg-neutral-800"
              : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
          }`}
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={toggleVoiceInput}
          title={isListening ? "Stop listening" : "Voice Input (Mic)"}
          className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
            isListening
              ? "bg-red-500 text-white animate-pulse"
              : isDark
                ? "text-neutral-400 hover:text-white hover:bg-neutral-800"
                : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
          }`}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <input
          type="text"
          aria-label="Message to Aethi"
          value={inputMessage}
          onPaste={handlePaste}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder={
            isListening
              ? "Listening to your voice..."
              : "Type message, drop files, or paste screenshots..."
          }
          className={`w-full py-2.5 px-2 bg-transparent text-sm placeholder-neutral-500 focus:outline-none ${
            isDark ? "text-white" : "text-neutral-900"
          }`}
        />

        <button
          type="submit"
          aria-label="Send message"
          disabled={(!inputMessage.trim() && attachments.length === 0) || isLoading}
          className="p-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 text-white shrink-0 shadow-md shadow-red-950/30 transition-all disabled:opacity-40 cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
