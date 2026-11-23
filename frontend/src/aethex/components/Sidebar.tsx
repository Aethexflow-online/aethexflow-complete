import React from 'react';
import { motion } from 'motion/react';
import {
  LayoutDashboard,
  MessageSquareCode,
  Clapperboard,
  Wrench,
  Bot,
  Settings,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';

export type NavTab = 'home' | 'chat' | 'studio' | 'tools' | 'bots' | 'store' | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  theme: 'dark' | 'light';
  operatorName?: string;
  brandName?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  theme,
  operatorName = 'Workspace Operator',
  brandName = 'AethexFlow',
}) => {
  const isDark = theme === 'dark';

  const initials = operatorName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'OP';

  const coreNav: { id: NavTab; label: string; badge: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home Dashboard', badge: '01', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'chat', label: 'AI Chat Assistant', badge: '02', icon: <MessageSquareCode className="w-4 h-4" /> },
  ];

  const studioNav: { id: NavTab; label: string; badge: string; icon: React.ReactNode }[] = [
    { id: 'studio', label: 'Video & Photo Studio', badge: '03', icon: <Clapperboard className="w-4 h-4" /> },
    { id: 'tools', label: 'Tools & Utilities', badge: '04', icon: <Wrench className="w-4 h-4" /> },
    { id: 'bots', label: 'Automation Bots', badge: '05', icon: <Bot className="w-4 h-4" /> },
    { id: 'store', label: 'Sell & Affiliates', badge: '06', icon: <ShoppingBag className="w-4 h-4" /> },
  ];

  const renderItem = (item: { id: NavTab; label: string; badge: string; icon: React.ReactNode }) => {
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onSelectTab(item.id)}
        className={`relative w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
          isActive
            ? 'text-white shadow-md shadow-red-600/20'
            : isDark
            ? 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
        }`}
      >
        {isActive && (
          <motion.div
            layoutId="activeSidebarPill"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="absolute inset-0 bg-gradient-to-r from-red-600 to-rose-600 rounded-xl -z-0"
          />
        )}
        <span className="relative z-10 flex items-center gap-2.5">
          {item.icon}
          <span>{item.label}</span>
        </span>
        <span
          className={`relative z-10 text-[10px] font-mono ${
            isActive ? 'text-white/80' : isDark ? 'text-neutral-600' : 'text-neutral-400'
          }`}
        >
          {item.badge}
        </span>
      </button>
    );
  };

  return (
    <aside
      className={`w-68 h-screen sticky top-0 flex flex-col justify-between border-r p-4 select-none transition-colors duration-300 ${
        isDark ? 'bg-[#0c0e14] border-neutral-800/80' : 'bg-white border-neutral-200/90'
      }`}
    >
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 py-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-rose-600 text-white font-extrabold flex items-center justify-center shadow-md shadow-red-600/20">
            {brandName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`font-extrabold text-sm tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                {brandName}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-600">
                V4.2
              </span>
            </div>
            <p className="text-[10px] font-mono tracking-wider uppercase text-neutral-400">
              Edge Automation Studio
            </p>
          </div>
        </div>

        {/* Workspace Pill */}
        <div
          className={`flex items-center justify-between px-3 py-2 rounded-xl border mb-6 text-[10px] font-mono ${
            isDark
              ? 'bg-neutral-900/70 border-neutral-800 text-neutral-400'
              : 'bg-neutral-50 border-neutral-200 text-neutral-600'
          }`}
        >
          <span className="font-semibold">WORKSPACE: ACTIVE</span>
          <span className="flex items-center gap-1 text-emerald-600 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Edge ready
          </span>
        </div>

        {/* Navigation Groups */}
        <div className="space-y-5">
          <div>
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Core Platform
            </p>
            <div className="space-y-1">{coreNav.map(renderItem)}</div>
          </div>

          <div>
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Studios & AI Tools
            </p>
            <div className="space-y-1">{studioNav.map(renderItem)}</div>
          </div>

          <div>
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              System
            </p>
            {renderItem({
              id: 'settings',
              label: 'Settings & Security',
              badge: '06',
              icon: <Settings className="w-4 h-4" />,
            })}
          </div>
        </div>
      </div>

      {/* Bottom Dynamic Operator Card */}
      <div
        className={`p-3 rounded-2xl border flex items-center gap-3 transition-colors ${
          isDark
            ? 'bg-neutral-900/80 border-neutral-800'
            : 'bg-neutral-50 border-neutral-200'
        }`}
      >
        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            {operatorName}
          </p>
          <p className="text-[11px] text-neutral-500 flex items-center gap-1 truncate">
            <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
            <span>Workspace Operator</span>
          </p>
        </div>
      </div>
    </aside>
  );
};