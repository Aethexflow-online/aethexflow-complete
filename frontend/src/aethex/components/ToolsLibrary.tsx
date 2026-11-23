import React, { useState } from 'react';
import {
  Search,
  Pin,
  ShieldCheck,
  Image,
  FileText,
  Languages,
  Bot,
  RefreshCw,
  ExternalLink,
  Film,
  Braces,
} from 'lucide-react';
import { ToolItem } from '../utils/toolsData';

interface ToolsLibraryProps {
  tools: ToolItem[];
  onTogglePin: (id: string) => void;
  onOpenTool: (id: string) => void;
  theme: 'dark' | 'light';
}

export const ToolsLibrary: React.FC<ToolsLibraryProps> = ({
  tools,
  onTogglePin,
  onOpenTool,
  theme,
}) => {
  const isDark = theme === 'dark';
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All tools' },
    { id: 'pinned', label: 'Pinned' },
    { id: 'images', label: 'Images' },
    { id: 'documents', label: 'Documents' },
    { id: 'text', label: 'Text & language' },
    { id: 'developer', label: 'Developer' },
    { id: 'utilities', label: 'Utilities' },
  ];

  const filteredTools = tools.filter((tool) => {
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.actionKeywords.some((kw) => kw.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'pinned') return tool.isPinned;
    return tool.category === selectedCategory;
  });

  const pinnedTools = filteredTools.filter((t) => t.isPinned);
  const discoverTools = filteredTools.filter((t) => !t.isPinned);

  const getIcon = (name: string) => {
    switch (name) {
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
      case 'Braces':
        return <Braces className="w-5 h-5 text-red-500" />;
      case 'Bot':
        return <Bot className="w-5 h-5 text-red-500" />;
      case 'ShieldCheck':
      default:
        return <ShieldCheck className="w-5 h-5 text-red-500" />;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
      {/* Header and Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            Tools & Utilities Library
          </h1>
          <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            Install, pin, and launch real browser & edge tools.
          </p>
        </div>

        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            aria-label="Search tools"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools..."
            className={`w-full pl-10 pr-4 py-2 rounded-xl border text-xs focus:border-red-500 focus:outline-none transition-all ${
              isDark
                ? 'border-neutral-800 bg-neutral-900/60 text-white placeholder-neutral-500'
                : 'border-neutral-200 bg-white text-neutral-900 placeholder-neutral-400'
            }`}
          />
        </div>
      </div>

      {/* Main Layout: Left categories & right tool cards */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Category filters */}
        <div className="lg:col-span-1 space-y-1">
          {categories.map((cat) => (
            <button
              type="button"
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                selectedCategory === cat.id
                  ? 'bg-red-600/15 text-red-500 border border-red-500/30 font-bold'
                  : isDark
                  ? 'text-neutral-400 hover:text-white hover:bg-neutral-800/40'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              <span>{cat.label}</span>
              {cat.id === 'pinned' && <span className="w-2 h-2 rounded-full bg-red-500"></span>}
            </button>
          ))}
        </div>

        {/* Tools Content Grid */}
        <div className="lg:col-span-4 space-y-6">
          {/* Hero Banner */}
          <div className="p-6 rounded-2xl border border-red-500/25 bg-gradient-to-br from-red-950/50 via-neutral-950/90 to-[#12131b] relative overflow-hidden shadow-xl shadow-red-950/20">
            <div className="absolute -right-10 -bottom-10 w-60 h-60 rounded-full border border-red-600/10 pointer-events-none"></div>
            <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full border border-red-600/10 pointer-events-none"></div>

            <div className="relative z-10 space-y-2 max-w-xl">
              <h2 className="text-xl font-black text-white">Real client-side & edge execution.</h2>
              <p className="text-xs text-neutral-300 leading-relaxed">
                PDF compression via pdf-lib, AES-256-GCM cryptography via WebCrypto, JSON/CSV transformations, and multi-track video editing run directly with zero mock stubs.
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-900/40 border border-red-500/40 text-[10px] font-black uppercase tracking-wider text-red-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-red-400" />
                  Permission-First By Default
                </span>
              </div>
            </div>
          </div>

          {/* Pinned Tools Section */}
          {pinnedTools.length > 0 && (
            <div className="space-y-3">
              <div>
                <h3 className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                  Pinned tools
                </h3>
                <p className="text-[11px] text-neutral-400">Visible on Home for zero-friction access.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pinnedTools.map((tool) => (
                  <div
                    key={tool.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between group ${
                      isDark
                        ? 'border-neutral-800/80 bg-neutral-900/40 hover:border-red-500/30'
                        : 'border-neutral-200 bg-white hover:border-red-300 shadow-sm'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center">
                          {getIcon(tool.iconName)}
                        </div>
                        <button
                          type="button"
                          onClick={() => onTogglePin(tool.id)}
                          aria-label={`Unpin ${tool.name}`}
                          title="Unpin tool"
                          className={`p-1.5 rounded-lg text-red-500 transition-colors ${
                            isDark ? 'hover:bg-neutral-800' : 'hover:bg-neutral-100'
                          }`}
                        >
                          <Pin className="w-4 h-4 fill-red-500" />
                        </button>
                      </div>

                      <h4 className={`font-bold text-sm group-hover:text-red-500 transition-colors ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                        {tool.name}
                      </h4>
                      <p className={`text-xs mt-1 line-clamp-2 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                        {tool.description}
                      </p>
                    </div>

                    <div
                      className={`flex items-center justify-between pt-4 mt-2 border-t text-xs ${
                        isDark ? 'border-neutral-800/60' : 'border-neutral-100'
                      }`}
                    >
                      <span className="text-[11px] text-neutral-400">{tool.categoryLabel} • Installed</span>
                      <button
                        type="button"
                        onClick={() => onOpenTool(tool.id)}
                        className="px-3 py-1 rounded-lg bg-red-600/15 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 font-semibold transition-all flex items-center gap-1"
                      >
                        <span>Open</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Discover Tools Section */}
          <div className="space-y-3">
            <div>
              <h3 className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                Discover tools
              </h3>
              <p className="text-[11px] text-neutral-400">
                Browse studios, security modules, and developer utilities.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {discoverTools.map((tool) => (
                <div
                  key={tool.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between group ${
                    isDark
                      ? 'border-neutral-800/80 bg-neutral-900/40 hover:border-neutral-700'
                      : 'border-neutral-200 bg-white hover:border-neutral-300 shadow-sm'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                          isDark ? 'bg-neutral-800/70 border-neutral-700/60' : 'bg-neutral-50 border-neutral-200'
                        }`}
                      >
                        {getIcon(tool.iconName)}
                      </div>
                      <button
                        type="button"
                        onClick={() => onTogglePin(tool.id)}
                        aria-label={`Pin ${tool.name}`}
                        title="Pin tool"
                        className={`p-1.5 rounded-lg text-neutral-400 hover:text-red-500 transition-colors ${
                          isDark ? 'hover:bg-neutral-800' : 'hover:bg-neutral-100'
                        }`}
                      >
                        <Pin className="w-4 h-4" />
                      </button>
                    </div>

                    <h4 className={`font-bold text-sm group-hover:text-red-500 transition-colors ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                      {tool.name}
                    </h4>
                    <p className={`text-xs mt-1 line-clamp-2 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                      {tool.description}
                    </p>
                  </div>

                  <div
                    className={`flex items-center justify-between pt-4 mt-2 border-t text-xs ${
                      isDark ? 'border-neutral-800/60' : 'border-neutral-100'
                    }`}
                  >
                    <span className="text-[11px] text-neutral-400">{tool.categoryLabel}</span>
                    <button
                      type="button"
                      onClick={() => onOpenTool(tool.id)}
                      className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                        isDark
                          ? 'bg-neutral-800 hover:bg-red-600 text-neutral-300 hover:text-white'
                          : 'bg-neutral-100 hover:bg-red-600 text-neutral-700 hover:text-white'
                      }`}
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
