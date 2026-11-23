import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageCircleQuestion,
  X,
  Send,
  Paperclip,
  Mic,
  MicOff,
  FileText,
  Volume2,
  Loader2,
  Sparkles,
  Cpu,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import {
  getOnlineAPIKeyInMemory,
  normalizeLocalOllamaUrl,
  readAIConnectionSettings,
} from '../utils/aiProviders';

interface AttachedFile {
  id: string;
  name: string;
  mimeType: string;
  base64: string;
  previewUrl?: string;
}

interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  files?: Array<{ name: string; previewUrl?: string }>;
  isAethi?: boolean;
}

const COPILOT_HISTORY_KEY = 'aethexflow.copilot-history.v1';
const LOCAL_TASKS_KEY = 'aethexflow.local-tasks.v1';
const MAX_COPILOT_MESSAGES = 100;

interface FloatingCopilotProps {
  theme: 'dark' | 'light';
  activeTab: string;
  operatorName?: string;
  brandName?: string;
  onLogActivity?: (action: string) => void;
}

const PAGE_LABELS: Record<string, string> = {
  home: 'Home Dashboard',
  studio: 'Video & Photo Studio',
  tools: 'Tools & Utilities',
  bots: 'Automation Bots',
  settings: 'Settings & Security',
};

export const FloatingCopilot: React.FC<FloatingCopilotProps> = ({
  theme,
  activeTab,
  operatorName = 'Operator',
  brandName = 'AethexFlow',
  onLogActivity,
}) => {
  const isDark = theme === 'dark';
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [aethiStatus, setAethiStatus] = useState<string | null>(null);

  const makeWelcomeMessage = (): CopilotMessage => ({
      id: 'help_welcome',
      role: 'assistant',
      text: `Peace be upon you, ${operatorName}! Need help on this page or want to queue a task for your local Aethi agent? Ask me anything.`,
  });

  const [messages, setMessages] = useState<CopilotMessage[]>(() => [makeWelcomeMessage()]);
  const [historyReady, setHistoryReady] = useState(false);

  useEffect(() => {
      try {
        const saved = window.localStorage.getItem(COPILOT_HISTORY_KEY);
        const parsed: unknown = saved ? JSON.parse(saved) : null;
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(
            (message): message is CopilotMessage =>
              message &&
              typeof message === 'object' &&
              typeof message.id === 'string' &&
              (message.role === 'user' || message.role === 'assistant') &&
              typeof message.text === 'string',
          );
          if (valid.length) {
            setMessages(valid.slice(-MAX_COPILOT_MESSAGES).map((message) => ({
              ...message,
              files: message.files?.map(({ name }) => ({ name })),
            })));
          }
        }
      } catch {
        // Corrupt or unavailable browser storage starts a fresh local history.
      }
    setHistoryReady(true);
  }, []);

  useEffect(() => {
    if (!historyReady) return;
    try {
      const localOnly = messages.slice(-MAX_COPILOT_MESSAGES).map((message) => ({
        ...message,
        files: message.files?.map(({ name }) => ({ name })),
      }));
      window.localStorage.setItem(COPILOT_HISTORY_KEY, JSON.stringify(localOnly));
    } catch {
      // Keep the copilot usable if local browser storage is unavailable.
    }
  }, [messages, historyReady]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  if (activeTab === 'chat') return null;

  const processFiles = (fileList: FileList | File[]) => {
    Array.from(fileList).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        const isImage = file.type.startsWith('image/');
        setAttachments((prev) => [
          ...prev,
          {
            id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
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

  const toggleMic = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice recognition is supported in Chrome and Edge browsers.');
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.onstart = () => setIsListening(true);
    rec.onresult = (ev: any) => {
      const transcript = Array.from(ev.results)
        .map((r: any) => r[0].transcript)
        .join('');
      setInput(transcript);
    };
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    rec.start();
  };

  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  const dispatchAethiTask = async (goalText: string) => {
    try {
      const saved = window.localStorage.getItem(LOCAL_TASKS_KEY);
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      const tasks = Array.isArray(parsed) ? parsed : [];
      const task = {
        id: `local_${Date.now()}`,
        goal: goalText.slice(0, 1500),
        sourceTab: activeTab,
        createdAt: new Date().toISOString(),
        status: 'awaiting-local-hub',
      };
      window.localStorage.setItem(
        LOCAL_TASKS_KEY,
        JSON.stringify([...tasks, task].slice(-50)),
      );
      setAethiStatus('Saved on this device. No command was sent to the site.');
      onLogActivity?.(`Aethi task saved locally: ${goalText.slice(0, 36)}`);
      setTimeout(() => setAethiStatus(null), 5000);
    } catch {
      setAethiStatus('Could not save this task to local browser storage.');
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = input.trim();
    if (!clean && attachments.length === 0) return;
    if (isLoading) return;

    const currentFiles = [...attachments];
    const lower = clean.toLowerCase();
    const needsLocalAethi =
      lower.includes('aethi') ||
      lower.includes('local') ||
      lower.includes('pc') ||
      lower.includes('desktop') ||
      lower.includes('whatsapp send') ||
      lower.includes('automate');

    setMessages((prev) => [
      ...prev,
      {
        id: `u_${Date.now()}`,
        role: 'user',
        text: clean || `Sent ${currentFiles.length} file(s)`,
        files: currentFiles.map((f) => ({ name: f.name, previewUrl: f.previewUrl })),
        isAethi: needsLocalAethi,
      },
    ]);

    setInput('');
    setAttachments([]);
    setIsLoading(true);

    if (needsLocalAethi) {
      await dispatchAethiTask(clean);
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: 'Saved on this device. It has not been executed. Pairing the local Hub and adding an explicit device action is required before any PC control.',
          isAethi: true,
        },
      ]);
      setIsLoading(false);
      return;
    }

    const pageName = PAGE_LABELS[activeTab] || activeTab;
    const contextualPrompt = `[User is on page: "${pageName}"]\n${clean || 'Please review the attached file(s).'}`;

    try {
      const settings = readAIConnectionSettings();
      let reply = '';
      if (settings.mode === 'local') {
        if (!settings.localModel.trim()) throw new Error('Choose a local model in Settings first.');
        const image = currentFiles.find((file) => file.mimeType.startsWith('image/'));
        const content = image
          ? [
              { type: 'text', text: contextualPrompt },
              { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.base64}` } },
            ]
          : contextualPrompt;
        const response = await fetch(`${normalizeLocalOllamaUrl(settings.localUrl)}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: settings.localModel.trim(),
            messages: [{ role: 'user', content }],
            max_tokens: 700,
            temperature: 0.4,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(`Local model request failed (${response.status}).`);
        reply = data.choices?.[0]?.message?.content || '';
      } else {
        const connection = settings.mode === 'online'
          ? {
              mode: 'online',
              providerId: settings.onlineProvider,
              model: settings.onlineModel,
              apiKey: getOnlineAPIKeyInMemory(),
            }
          : undefined;
        if (settings.mode === 'online' && !connection?.apiKey) {
          throw new Error('Add your online provider key in Settings → AI connections.');
        }
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: contextualPrompt,
            attachment: currentFiles[0]
              ? { name: currentFiles[0].name, mimeType: currentFiles[0].mimeType, base64: currentFiles[0].base64 }
              : null,
            attachments: currentFiles.map((file) => ({
              name: file.name,
              mimeType: file.mimeType,
              base64: file.base64,
            })),
            brandName,
            operatorName,
            ...(connection ? { connection } : {}),
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Aethi could not answer (${response.status}).`);
        reply = data.reply || data.text || '';
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: reply || 'Aethi could not answer just now. Try again.',
        },
      ]);
      onLogActivity?.(`Help Assistant answered on ${pageName}`);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          text: error instanceof Error ? error.message : 'Network error reaching the selected AI service.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-40">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
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
            className={`mb-3 w-88 sm:w-96 rounded-2xl border shadow-2xl overflow-hidden flex flex-col relative ${
              isDark
                ? 'bg-[#11131b] border-neutral-800 text-white'
                : 'bg-white border-neutral-200 text-neutral-900'
            }`}
          >
            {isDragging && (
              <div className="absolute inset-0 z-20 bg-red-600/90 text-white flex flex-col items-center justify-center p-4 text-center">
                <Paperclip className="w-7 h-7 mb-2" />
                <p className="text-sm font-bold">Drop files here to attach</p>
              </div>
            )}

            <div className="px-4 py-3 bg-gradient-to-r from-red-600 to-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <div>
                  <p className="text-xs font-bold leading-none">{brandName} Assistant</p>
                  <p className="text-[10px] text-white/85 mt-0.5">
                    Context: {PAGE_LABELS[activeTab] || activeTab}
                  </p>
                  <p className="text-[9px] text-white/75 mt-0.5">
                    History stays here. The selected AI service receives prompts for replies.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Clear Aethi copilot history saved on this device?')) {
                    setMessages([makeWelcomeMessage()]);
                  }
                }}
                aria-label="Clear copilot history saved on this device"
                className="p-1 rounded-lg hover:bg-white/20 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-white/20 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {aethiStatus && (
              <div className="px-3 py-1.5 bg-amber-500/15 border-b border-amber-500/20 text-amber-600 text-[11px] font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{aethiStatus}</span>
              </div>
            )}

            <div className="p-3.5 h-72 overflow-y-auto space-y-3 text-xs">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-red-600 text-white'
                        : isDark
                        ? 'bg-neutral-900 border border-neutral-800 text-neutral-200'
                        : 'bg-neutral-100 text-neutral-800'
                    }`}
                  >
                    {m.files && m.files.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {m.files.map((f, idx) =>
                          f.previewUrl ? (
                            <img
                              key={idx}
                              src={f.previewUrl}
                              alt={f.name}
                              className="w-16 h-16 object-cover rounded-lg border border-white/20"
                            />
                          ) : (
                            <span
                              key={idx}
                              className="px-2 py-1 rounded-lg bg-black/15 text-[10px] font-mono flex items-center gap-1"
                            >
                              <FileText className="w-3 h-3" />
                              {f.name}
                            </span>
                          )
                        )}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    {m.role === 'assistant' && (
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] opacity-65">
                        <button
                          type="button"
                          onClick={() => speakText(m.text)}
                          className="hover:opacity-100 hover:text-red-500 flex items-center gap-1 cursor-pointer"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>Listen</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-1.5 text-neutral-400 text-[11px]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                  <span>Assistant is thinking...</span>
                </div>
              )}
            </div>

            {attachments.length > 0 && (
              <div className="px-3 py-2 border-t border-neutral-200 dark:border-neutral-800 flex flex-wrap gap-2">
                {attachments.map((file) => (
                  <div
                    key={file.id}
                    className="relative group flex items-center gap-1.5 px-2 py-1 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-[11px]"
                  >
                    {file.previewUrl ? (
                      <img
                        src={file.previewUrl}
                        alt={file.name}
                        className="w-7 h-7 rounded-md object-cover"
                      />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    )}
                    <span className="max-w-24 truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((prev) => prev.filter((item) => item.id !== file.id))
                      }
                      className="p-0.5 rounded-full hover:bg-red-500/20 text-neutral-400 hover:text-red-500 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form
              onSubmit={handleSend}
              className={`p-2 border-t flex items-center gap-1.5 ${
                isDark ? 'border-neutral-800 bg-neutral-900/50' : 'border-neutral-200 bg-neutral-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,text/*,.csv,.json,.md,audio/*,video/*"
                onChange={(e) => {
                  if (e.target.files) processFiles(e.target.files);
                  e.target.value = '';
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach files (or drag & paste)"
                className="p-2 rounded-lg text-neutral-400 hover:text-red-500 cursor-pointer"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={toggleMic}
                title="Voice input"
                className={`p-2 rounded-lg cursor-pointer ${
                  isListening ? 'text-red-500 animate-pulse' : 'text-neutral-400 hover:text-red-500'
                }`}
              >
                {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
              <input
                type="text"
                value={input}
                onPaste={handlePaste}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask for help or paste file..."
                className="flex-1 bg-transparent text-xs outline-none px-1"
              />
              <button
                type="submit"
                disabled={isLoading || (!input.trim() && attachments.length === 0)}
                className="p-2 rounded-xl bg-red-600 text-white disabled:opacity-40 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="px-4 h-11 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/25 flex items-center gap-2 text-xs font-bold cursor-pointer ml-auto"
      >
        {isOpen ? (
          <X className="w-4 h-4" />
        ) : (
          <>
            <MessageCircleQuestion className="w-4 h-4" />
            <span>Need Help?</span>
          </>
        )}
      </motion.button>
    </div>
  );
};
