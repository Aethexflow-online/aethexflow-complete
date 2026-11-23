import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Mic,
  MicOff,
  ArrowUp,
  Pin,
  Sparkles,
  Zap,
  Image,
  FileText,
  RefreshCw,
  Languages,
  Clock,
  ArrowRight,
  Film,
  ShieldCheck,
  Braces,
  Bot,
  Download,
  Cpu,
  MessageSquareCode,
} from 'lucide-react';
import { ToolItem } from '../utils/toolsData';
import { parseNaturalIntent } from '../utils/intentParser';
import { executeAutomatedPipeline } from '../utils/dagEngine';

interface HomeDashboardProps {
  tools: ToolItem[];
  onOpenTool: (id: string) => void;
  onNavigateTab: (tab: any, initialPrompt?: string) => void;
  theme: 'dark' | 'light';
  activityLog: Array<{ id: string; action: string; time: string; status: string }>;
  onLogActivity?: (action: string) => void;
  operatorName?: string;
  brandName?: string;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  tools,
  onOpenTool,
  onNavigateTab,
  theme,
  activityLog,
  onLogActivity,
  operatorName = 'Workspace Operator',
  brandName = 'AethexFlow',
}) => {
  const isDark = theme === 'dark';
  const [commandInput, setCommandInput] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  const [routedNotification, setRoutedNotification] = useState<{
    label: string;
    message: string;
    confidence: number;
    pipelineSteps: number;
  } | null>(null);

  const pinnedTools = tools.filter((t) => t.isPinned);

  const toggleVoiceSearch = () => {
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

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join('');
      setCommandInput(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  const executeParsedIntent = (query: string) => {
    const clean = query.trim();
    if (!clean) return;

    const lower = clean.toLowerCase();
    const intent = parseNaturalIntent(clean);

    const isExplicitToolCommand =
      (intent.type === 'LAUNCH_TOOL' || intent.type === 'MASTER_VAULT') &&
      intent.confidence >= 0.78 &&
      (lower.includes('open') ||
        lower.includes('compress') ||
        lower.includes('encrypt') ||
        lower.includes('vault') ||
        lower.includes('background') ||
        lower.includes('convert') ||
        lower.includes('translate') ||
        lower.includes('format') ||
        lower.includes('studio'));

    if (isExplicitToolCommand) {
      const pipeline = executeAutomatedPipeline(intent.label);
      setRoutedNotification({
        label: intent.label,
        message: intent.description,
        confidence: intent.confidence,
        pipelineSteps: pipeline.stepsExecuted.length,
      });
      onLogActivity?.(`Autonomous router executed: ${intent.label}`);

      setTimeout(() => {
        setRoutedNotification(null);
        if (intent.type === 'LAUNCH_TOOL') {
          onOpenTool(intent.targetId);
        } else if (intent.type === 'MASTER_VAULT') {
          window.location.hash = '#control-vault-master';
        }
      }, 350);
      return;
    }

    onLogActivity?.(`AI Smart Search routed to Copilot: "${clean.slice(0, 42)}..."`);
    onNavigateTab('chat', clean);
  };

  const handleCommandRoute = (promptQuery: string) => {
    if (!promptQuery.trim()) return;
    executeParsedIntent(promptQuery);
  };

  const getToolIcon = (iconName: string) => {
    switch (iconName) {
      case 'Image':
        return <Image className="w-5 h-5 text-red-500" />;
      case 'FileText':
        return <FileText className="w-5 h-5 text-red-500" />;
      case 'RefreshCw':
        return <RefreshCw className="w-5 h-5 text-red-500" />;
      case 'Languages':
        return <Languages className="w-5 h-5 text-red-500" />;
      case 'Film':
        return <Film className="w-5 h-5 text-red-500" />;
      case 'ShieldCheck':
        return <ShieldCheck className="w-5 h-5 text-red-500" />;
      case 'Braces':
        return <Braces className="w-5 h-5 text-red-500" />;
      case 'Bot':
        return <Bot className="w-5 h-5 text-red-500" />;
      default:
        return <Sparkles className="w-5 h-5 text-red-500" />;
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-14 animate-in fade-in duration-300">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pt-2">
        <div className="space-y-3">
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold tracking-wide ${
              isDark
                ? 'bg-slate-900/70 border-slate-800 text-neutral-300'
                : 'bg-white border-neutral-200 text-neutral-700 shadow-xs'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{brandName} • Workspace</span>
          </div>

          <h1
            className={`text-3xl sm:text-5xl font-black tracking-tight leading-[1.12] ${
              isDark ? 'text-white' : 'text-neutral-900'
            }`}
          >
            Peace be upon you,{' '}
            <span className="bg-gradient-to-r from-red-600 via-rose-500 to-red-600 bg-clip-text text-transparent">
              {operatorName}.
            </span>
          </h1>

          <p
            className={`text-sm sm:text-base max-w-2xl leading-relaxed ${
              isDark ? 'text-neutral-400' : 'text-neutral-600'
            }`}
          >
            AI chat, local browser tools, and optional Aethi Hub for desktop control.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <a
            href="/aethi-local-agent.zip"
            download="aethi-local-agent.zip"
            onClick={() => {
              onLogActivity?.('Downloaded Aethi Local Desktop Agent package');
            }}
            className={`px-4 py-2.5 rounded-2xl border font-bold text-xs flex items-center gap-2 transition-all shadow-sm cursor-pointer ${
              isDark
                ? 'bg-red-600/15 border-red-500/30 text-red-400 hover:bg-red-600/25 hover:border-red-500/50'
                : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:border-red-300'
            }`}
            title="Download local Aethi agent for your PC"
          >
            <Cpu className="w-4 h-4 text-red-500 animate-pulse" />
            <span>Download Aethi Agent</span>
            <Download className="w-3.5 h-3.5 ml-0.5" />
          </a>
        </div>
      </div>

      {routedNotification && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs shadow-lg ${
            isDark
              ? 'border-red-500/40 bg-red-950/30 text-red-200'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            <span className="font-semibold">{routedNotification.label}:</span>
            <span className={isDark ? 'text-neutral-300' : 'text-neutral-700'}>
              {routedNotification.message} ({routedNotification.pipelineSteps}-stage DAG verified)
            </span>
          </div>
          <span className="font-mono text-[10px] text-emerald-600 font-bold">
            {(routedNotification.confidence * 100).toFixed(0)}% Parsed
          </span>
        </motion.div>
      )}

      <div
        className={`p-8 sm:p-10 rounded-3xl border text-center space-y-5 relative overflow-hidden transition-all ${
          isDark
            ? 'bg-gradient-to-b from-[#131622] to-[#0e1018] border-neutral-800/90 shadow-2xl'
            : 'bg-gradient-to-b from-white to-neutral-50/80 border-neutral-200/90 shadow-xl shadow-neutral-200/40'
        }`}
      >
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-[11px] font-bold text-red-600 uppercase tracking-wider">
          <Zap className="w-3.5 h-3.5 text-red-500" />
          <span>AI Smart Router & Copilot</span>
        </div>

        <h2
          className={`text-2xl sm:text-4xl font-black tracking-tight ${
            isDark ? 'text-white' : 'text-neutral-900'
          }`}
        >
          What would you like to build or ask?
        </h2>

        <p
          className={`text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed ${
            isDark ? 'text-neutral-400' : 'text-neutral-600'
          }`}
        >
          Ask any question to jump straight into a live AI conversation, or type a tool command like{' '}
          <span className="font-semibold text-red-500">“open video studio”</span> or{' '}
          <span className="font-semibold text-red-500">“compress PDF”</span>.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCommandRoute(commandInput);
          }}
          className={`max-w-2xl mx-auto relative flex items-center rounded-2xl border-2 transition-all p-2 shadow-sm ${
            isDark
              ? 'border-neutral-800 bg-neutral-900/90 focus-within:border-red-500'
              : 'border-neutral-200 bg-white focus-within:border-red-500 shadow-neutral-200/50'
          }`}
        >
          <button
            type="button"
            onClick={toggleVoiceSearch}
            title={isListening ? 'Stop listening' : 'Voice Search'}
            className={`p-2.5 rounded-xl transition-colors cursor-pointer shrink-0 ${
              isListening
                ? 'bg-red-500 text-white animate-pulse'
                : 'text-neutral-400 hover:text-red-500 hover:bg-red-500/10'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            type="text"
            aria-label="Ask AI or launch tool"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder={
              isListening
                ? 'Listening to your voice...'
                : 'Ask Aethe AI anything or run a tool command...'
            }
            className={`w-full py-2.5 px-3 bg-transparent text-sm placeholder-neutral-400 focus:outline-none ${
              isDark ? 'text-white' : 'text-neutral-900'
            }`}
          />

          <button
            type="submit"
            disabled={!commandInput.trim()}
            className="px-4 h-10 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-md shadow-red-600/20 transition-all active:scale-95 cursor-pointer"
            aria-label="Send to AI"
          >
            <span className="hidden sm:inline">Ask AI</span>
            <ArrowUp className="w-4 h-4" />
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs">
          <button
            type="button"
            onClick={() =>
              handleCommandRoute('Create a high-converting WhatsApp sales script for my business')
            }
            className={`px-3.5 py-1.5 rounded-full border font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              isDark
                ? 'border-neutral-800 bg-neutral-900/60 hover:border-red-500/40 text-neutral-300 hover:text-white'
                : 'border-neutral-200 bg-white hover:border-red-300 text-neutral-700 hover:text-red-600 shadow-2xs'
            }`}
          >
            <MessageSquareCode className="w-3.5 h-3.5 text-red-500" />
            <span>Draft WhatsApp Sales Script</span>
          </button>

          <button
            type="button"
            onClick={() => handleCommandRoute('open video editor')}
            className={`px-3.5 py-1.5 rounded-full border font-medium transition-all cursor-pointer ${
              isDark
                ? 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700 text-neutral-300 hover:text-white'
                : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700 hover:text-neutral-900 shadow-2xs'
            }`}
          >
            Video & Photo Studio
          </button>

          <button
            type="button"
            onClick={() => handleCommandRoute('compress PDF')}
            className={`px-3.5 py-1.5 rounded-full border font-medium transition-all cursor-pointer ${
              isDark
                ? 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700 text-neutral-300 hover:text-white'
                : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700 hover:text-neutral-900 shadow-2xs'
            }`}
          >
            Compress PDF
          </button>

          <button
            type="button"
            onClick={() => handleCommandRoute('encrypt text')}
            className={`px-3.5 py-1.5 rounded-full border font-medium transition-all cursor-pointer ${
              isDark
                ? 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700 text-neutral-300 hover:text-white'
                : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700 hover:text-neutral-900 shadow-2xs'
            }`}
          >
            AES-256 Crypto Vault
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3
              className={`text-base sm:text-lg font-bold tracking-tight ${
                isDark ? 'text-white' : 'text-neutral-900'
              }`}
            >
              Pinned Tools
            </h3>
            <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
              Tools that run in your browser. Status reflects real capability.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('tools')}
            className="text-xs font-semibold text-red-600 hover:text-red-500 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>Explore All Tools</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {pinnedTools.map((tool) => (
            <motion.button
              whileHover={{ y: -3 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              type="button"
              key={tool.id}
              onClick={() => onOpenTool(tool.id)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer group flex flex-col justify-between text-left ${
                isDark
                  ? 'border-neutral-800/80 bg-[#12141c]/80 hover:border-red-500/40 hover:bg-[#151722]'
                  : 'border-neutral-200 bg-white hover:border-red-300 shadow-xs hover:shadow-md'
              }`}
            >
              <div>
                <div className="flex items-start justify-between mb-3.5">
                  <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                    {getToolIcon(tool.iconName)}
                  </div>
                  <Pin className="w-4 h-4 text-red-500 fill-red-500" />
                </div>

                <h4
                  className={`font-bold text-sm group-hover:text-red-600 transition-colors ${
                    isDark ? 'text-white' : 'text-neutral-900'
                  }`}
                >
                  {tool.name}
                </h4>
                <p
                  className={`text-xs mt-1.5 line-clamp-2 leading-relaxed ${
                    isDark ? 'text-neutral-400' : 'text-neutral-600'
                  }`}
                >
                  {tool.description}
                </p>
              </div>

              <div
                className={`pt-3.5 mt-4 border-t flex items-center gap-1.5 text-xs text-emerald-600 font-semibold w-full ${
                  isDark ? 'border-neutral-800/60' : 'border-neutral-100'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>{tool.status}</span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3
            className={`text-base sm:text-lg font-bold tracking-tight ${
              isDark ? 'text-white' : 'text-neutral-900'
            }`}
          >
            Activity Log
          </h3>
          <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            Only real actions from this session. Empty until you run something.
          </p>
        </div>

        <div className="space-y-2.5">
          {activityLog.slice(0, 4).map((act) => (
            <div
              key={act.id}
              className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs ${
                isDark
                  ? 'border-neutral-800/80 bg-neutral-900/40'
                  : 'border-neutral-200 bg-white shadow-2xs'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-red-500 ${
                    isDark ? 'bg-neutral-800/80' : 'bg-red-50'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p
                    className={`font-semibold ${
                      isDark ? 'text-neutral-200' : 'text-neutral-800'
                    }`}
                  >
                    {act.action}
                  </p>
                  <p className="text-[11px] text-neutral-400">{act.time}</p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20 text-[10px]">
                {act.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};