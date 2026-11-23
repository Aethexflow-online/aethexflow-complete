/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sidebar, NavTab } from './components/Sidebar';
import { HomeDashboard } from './components/HomeDashboard';
import { ToolsLibrary } from './components/ToolsLibrary';
import { VideoStudioEditor } from './components/VideoStudioEditor';
import { SettingsAndSecurity } from './components/SettingsAndSecurity';
import { AIChatAssistant } from './components/AIChatAssistant';
import { BotRentalCreator } from './components/BotRentalCreator';
import { AffiliateStore } from './components/AffiliateStore';
import { MasterControlDashboard } from './components/MasterControlDashboard';
import { AdminGatewayChat } from './components/AdminGatewayChat';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { FloatingCopilot } from './components/FloatingCopilot';
import { BackgroundRemoverModal } from './components/BackgroundRemoverModal';
import { PdfCompressorModal } from './components/PdfCompressorModal';
import { ImageConverterModal } from './components/ImageConverterModal';
import { TextTranslatorModal } from './components/TextTranslatorModal';
import { CryptoVaultModal } from './components/CryptoVaultModal';
import { DataFormatterModal } from './components/DataFormatterModal';
import { INITIAL_TOOLS, ToolItem } from './utils/toolsData';
import { Menu, Search, Moon, Sun, UserCheck } from 'lucide-react';

interface ActivityItem {
  id: string;
  action: string;
  time: string;
  status: string;
}

const INITIAL_ACTIVITY: ActivityItem[] = [];
const ACTIVITY_STORAGE_KEY = 'aethexflow_activity_log';

function isAdminSecretPath(): boolean {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/admin-gateway-secret');
}

function isMasterVaultRoute(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.location.hash === '#control-vault-master' ||
      window.location.pathname.includes('control-vault-master'))
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [initialChatPrompt, setInitialChatPrompt] = useState<string>('');

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [operatorName, setOperatorName] = useState<string>('Workspace Operator');
  const [brandName, setBrandName] = useState<string>('AethexFlow');
  const [prefsReady, setPrefsReady] = useState(false);

  const [isProfilePromptOpen, setIsProfilePromptOpen] = useState<boolean>(false);
  const [tempNameInput, setTempNameInput] = useState<string>('');

  const [tools, setTools] = useState<ToolItem[]>(INITIAL_TOOLS);

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isMasterVaultOpen, setIsMasterVaultOpen] = useState<boolean>(() => isMasterVaultRoute());
  const [isAdminGatewayOpen, setIsAdminGatewayOpen] = useState<boolean>(() => isAdminSecretPath());
  const [activityLog, setActivityLog] = useState<ActivityItem[]>(INITIAL_ACTIVITY);
  const [activityReady, setActivityReady] = useState(false);

  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(ACTIVITY_STORAGE_KEY) || '[]');
      if (Array.isArray(parsed)) {
        setActivityLog(parsed
          .filter(
          (item): item is ActivityItem =>
            item &&
            typeof item === 'object' &&
            typeof item.id === 'string' &&
            typeof item.action === 'string' &&
            typeof item.time === 'string' &&
            typeof item.status === 'string',
          )
          .slice(0, 50));
      }
    } catch {
      // Corrupt or unavailable browser storage starts with an empty local log.
    }
    setActivityReady(true);
  }, []);

  const isDark = theme === 'dark';

  useEffect(() => {
    const savedTheme = localStorage.getItem('aethexflow_theme');
    if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme);
    const savedName = localStorage.getItem('aethexflow_operator_name');
    if (savedName) setOperatorName(savedName);
    const params = new URLSearchParams(window.location.search);
    const urlBrand = params.get('brand');
    if (urlBrand) localStorage.setItem('aethexflow_brand_name', urlBrand);
    const savedBrand = urlBrand || localStorage.getItem('aethexflow_brand_name');
    if (savedBrand) setBrandName(savedBrand);
    const savedTools = localStorage.getItem('aethexflow_tools');
    if (savedTools) {
      try {
        const parsed = JSON.parse(savedTools) as ToolItem[];
        const hasLegacy = parsed.some((t) => t.id === 'clean-dubbing' || t.id === 'dag-builder');
        const hasVideoStudio = parsed.some((t) => t.id === 'video-studio');
        if (Array.isArray(parsed) && !hasLegacy && hasVideoStudio) setTools(parsed);
      } catch {
        /* keep defaults */
      }
    }
    setPrefsReady(true);
  }, []);

  useEffect(() => {
    if (!prefsReady) return;
    localStorage.setItem('aethexflow_theme', theme);
    document.documentElement.className = theme;
  }, [theme, prefsReady]);

  useEffect(() => {
    document.title = `${brandName} - Intelligence Workspace`;
  }, [brandName]);

  useEffect(() => {
    if (!prefsReady) return;
    localStorage.setItem('aethexflow_tools', JSON.stringify(tools));
  }, [tools, prefsReady]);

  useEffect(() => {
    if (!activityReady) return;
    try {
      localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(activityLog.slice(0, 50)));
    } catch {
      // Keep the workspace usable when browser storage is unavailable.
    }
  }, [activityLog, activityReady]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = tempNameInput.trim() || 'Workspace Operator';
    setOperatorName(cleanName);
    localStorage.setItem('aethexflow_operator_name', cleanName);
    setIsProfilePromptOpen(false);
  };

  useEffect(() => {
    const syncRoutes = () => {
      if (isAdminSecretPath()) {
        setIsAdminGatewayOpen(true);
        setIsMasterVaultOpen(false);
      } else {
        setIsAdminGatewayOpen(false);
        if (isMasterVaultRoute()) {
          setIsMasterVaultOpen(true);
        }
      }
    };
    window.addEventListener('hashchange', syncRoutes);
    window.addEventListener('popstate', syncRoutes);
    return () => {
      window.removeEventListener('hashchange', syncRoutes);
      window.removeEventListener('popstate', syncRoutes);
    };
  }, []);

  useEffect(() => {
    const head = document.head;
    let robotsMeta = head.querySelector('meta[name="robots"]') as HTMLMetaElement | null;

    if (isAdminGatewayOpen || isMasterVaultOpen) {
      if (!robotsMeta) {
        robotsMeta = document.createElement('meta');
        robotsMeta.name = 'robots';
        head.appendChild(robotsMeta);
      }
      robotsMeta.content = 'noindex, nofollow';
    } else if (robotsMeta) {
      robotsMeta.remove();
    }
  }, [isAdminGatewayOpen, isMasterVaultOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setIsMasterVaultOpen((prev) => !prev);
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'k' &&
        !isMasterVaultOpen &&
        !isAdminGatewayOpen
      ) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMasterVaultOpen, isAdminGatewayOpen]);

  const handleTogglePin = (toolId: string) => {
    setTools((prev) =>
      prev.map((t) => (t.id === toolId ? { ...t, isPinned: !t.isPinned } : t))
    );
  };

  const handleOpenTool = (toolId: string) => {
    if (toolId === 'video-studio') {
      setActiveTab('studio');
    } else if (toolId === 'bot-rental' || toolId === 'bot-runner') {
      setActiveTab('bots');
    } else if (toolId === 'ed25519-vault' || toolId === 'crypto-vault') {
      if (toolId === 'ed25519-vault') setActiveTab('settings');
      else setActiveModal('crypto-vault');
    } else if (toolId === 'bg-remover' || toolId === 'background-remover') {
      setActiveModal('bg-remover');
    } else {
      setActiveModal(toolId);
    }
  };

  const logActivity = (action: string) => {
    const newItem: ActivityItem = {
      id: `act_${Date.now()}`,
      action,
      time: 'Just now',
      status: 'Completed',
    };
    setActivityLog((prev) => [newItem, ...prev.slice(0, 10)]);
  };

  const toggleTheme = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  };

  const handleEnterAdminGateway = () => {
    window.history.pushState({}, '', '/admin-gateway-secret');
    setIsMasterVaultOpen(false);
    setIsAdminGatewayOpen(true);
  };

  const handleExitAdminGateway = () => {
    window.history.pushState({}, '', '/');
    setIsAdminGatewayOpen(false);
    setActiveTab('home');
  };

  if (isAdminGatewayOpen) {
    return (
      <div
        className={`min-h-screen w-full transition-colors duration-300 font-sans ${
          isDark ? 'bg-[#0b0d13] text-[#f1f3f9]' : 'bg-[#f6f8fc] text-neutral-900'
        }`}
      >
        <AdminGatewayChat
          theme={theme}
          onExit={handleExitAdminGateway}
          onLogActivity={logActivity}
        />
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex w-full transition-colors duration-300 font-sans ${
        isDark ? 'bg-[#0a0b0f] text-[#f1f3f9]' : 'bg-[#f8fafc] text-neutral-900'
      }`}
    >
      <AnimatePresence>
        {isProfilePromptOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.form
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              onSubmit={handleSaveProfile}
              className={`w-full max-w-md rounded-2xl p-6 border shadow-2xl ${
                isDark
                  ? 'bg-[#12141d] border-neutral-800 text-white'
                  : 'bg-white border-neutral-200 text-neutral-900'
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold">Initialize Your Workspace</h2>
                  <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    Set your operator display name for this browser session
                  </p>
                </div>
              </div>

              <input
                type="text"
                autoFocus
                placeholder="Enter your name (e.g. Shehroz)"
                value={tempNameInput}
                onChange={(e) => setTempNameInput(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm mb-4 outline-none transition-all ${
                  isDark
                    ? 'bg-neutral-900 border-neutral-700 text-white focus:border-red-500'
                    : 'bg-neutral-50 border-neutral-300 text-neutral-900 focus:border-red-500'
                }`}
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProfilePromptOpen(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium ${
                    isDark ? 'text-neutral-400 hover:bg-neutral-800' : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  Continue as Guest
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white shadow-sm transition-all cursor-pointer"
                >
                  Launch Workspace
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="hidden md:block">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            setIsMasterVaultOpen(false);
          }}
          theme={theme}
          operatorName={operatorName}
          brandName={brandName}
        />
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 md:hidden flex"
          >
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative z-10 w-72"
            >
              <Sidebar
                activeTab={activeTab}
                onSelectTab={(tab) => {
                  setActiveTab(tab);
                  setIsMasterVaultOpen(false);
                  setIsMobileMenuOpen(false);
                }}
                theme={theme}
                operatorName={operatorName}
                brandName={brandName}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header
          className={`h-16 px-6 flex items-center justify-between border-b shrink-0 backdrop-blur-xl z-20 transition-colors duration-300 ${
            isDark
              ? 'bg-[#0e1017]/90 border-neutral-800/80'
              : 'bg-white/90 border-neutral-200/80 shadow-xs'
          }`}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className={`p-2 rounded-lg md:hidden ${
                isDark
                  ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`font-bold text-sm tracking-tight flex items-center gap-1.5 cursor-pointer ${
                  isDark ? 'text-white' : 'text-neutral-900'
                }`}
                onClick={() => {
                  setActiveTab('home');
                  setIsMasterVaultOpen(false);
                }}
              >
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                <span>{brandName}</span>
              </button>
              <span
                className={`hidden sm:inline-block text-[11px] font-mono px-2 py-0.5 rounded border ${
                  isDark
                    ? 'text-neutral-400 bg-neutral-900 border-neutral-800'
                    : 'text-neutral-600 bg-neutral-100 border-neutral-200'
                }`}
              >
                v4.5 Aethi
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsProfilePromptOpen(true)}
              title="Change Operator Name"
              className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                isDark
                  ? 'border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:border-neutral-700'
                  : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <span>{operatorName}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all shadow-xs ${
                isDark
                  ? 'border-neutral-800 bg-neutral-900/60 hover:border-red-500/40 text-neutral-400 hover:text-white'
                  : 'border-neutral-200 bg-neutral-50 hover:border-red-300 text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Quick Find</span>
              <kbd
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-neutral-200 text-neutral-600'
                }`}
              >
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
              title={`Switch to ${isDark ? 'Studio Light' : 'Obsidian Dark'}`}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isDark
                  ? 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700 text-neutral-400 hover:text-white'
                  : 'border-neutral-200 bg-neutral-50 hover:border-neutral-300 text-neutral-700'
              }`}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-700" />}
            </button>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="hidden sm:inline">Edge ready</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
          <AnimatePresence mode="wait">
            {isMasterVaultOpen ? (
              <motion.div
                key="master-vault"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <MasterControlDashboard
                  theme={theme}
                  onClose={() => setIsMasterVaultOpen(false)}
                  onOpenTool={handleOpenTool}
                  onNavigateTab={(tab) => {
                    setActiveTab(tab);
                    setIsMasterVaultOpen(false);
                  }}
                  onOpenAdminGateway={handleEnterAdminGateway}
                  onLogActivity={logActivity}
                />
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                {activeTab === 'home' && (
                  <HomeDashboard
                    tools={tools}
                    onOpenTool={handleOpenTool}
                    onNavigateTab={(tab, prompt) => {
                      if (prompt) setInitialChatPrompt(prompt);
                      setActiveTab(tab);
                    }}
                    theme={theme}
                    activityLog={activityLog}
                    onLogActivity={logActivity}
                    operatorName={operatorName}
                    brandName={brandName}
                  />
                )}

                {activeTab === 'chat' && (
                  <AIChatAssistant
                    theme={theme}
                    onOpenTool={handleOpenTool}
                    onLogActivity={logActivity}
                    operatorName={operatorName}
                    brandName={brandName}
                    initialPrompt={initialChatPrompt}
                    onClearInitialPrompt={() => setInitialChatPrompt('')}
                  />
                )}

                {activeTab === 'studio' && (
                  <VideoStudioEditor
                    theme={theme}
                    onLogActivity={logActivity}
                  />
                )}

                {activeTab === 'tools' && (
                  <ToolsLibrary
                    tools={tools}
                    onTogglePin={handleTogglePin}
                    onOpenTool={handleOpenTool}
                    theme={theme}
                  />
                )}

                {activeTab === 'bots' && (
                  <BotRentalCreator
                    theme={theme}
                    onLogActivity={logActivity}
                  />
                )}

                {activeTab === 'store' && (
                  <AffiliateStore
                    theme={theme}
                    brandName={brandName}
                    onLogActivity={logActivity}
                  />
                )}

                {activeTab === 'settings' && (
                  <SettingsAndSecurity
                    theme={theme}
                    onToggleTheme={toggleTheme}
                    onLogActivity={logActivity}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      <FloatingCopilot
        theme={theme}
        activeTab={activeTab}
        operatorName={operatorName}
        brandName={brandName}
        onLogActivity={logActivity}
      />

      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onOpenTool={handleOpenTool}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          setIsMasterVaultOpen(false);
        }}
        onToggleTheme={toggleTheme}
        onOpenMasterVault={() => {
          window.location.hash = '#control-vault-master';
          setIsMasterVaultOpen(true);
        }}
        onLogActivity={logActivity}
      />

      <BackgroundRemoverModal
        isOpen={activeModal === 'background-remover' || activeModal === 'bg-remover'}
        onClose={() => setActiveModal(null)}
        theme={theme}
        onLogActivity={logActivity}
      />

      <PdfCompressorModal
        isOpen={activeModal === 'pdf-compressor'}
        onClose={() => setActiveModal(null)}
        theme={theme}
        onLogActivity={logActivity}
      />

      <ImageConverterModal
        isOpen={activeModal === 'image-converter'}
        onClose={() => setActiveModal(null)}
        theme={theme}
        onLogActivity={logActivity}
      />

      <TextTranslatorModal
        isOpen={activeModal === 'text-translator'}
        onClose={() => setActiveModal(null)}
        theme={theme}
        onLogActivity={logActivity}
      />

      <CryptoVaultModal
        isOpen={activeModal === 'crypto-vault'}
        onClose={() => setActiveModal(null)}
        theme={theme}
        onLogActivity={logActivity}
      />

      <DataFormatterModal
        isOpen={activeModal === 'data-formatter'}
        onClose={() => setActiveModal(null)}
        theme={theme}
        onLogActivity={logActivity}
      />
    </div>
  );
}
