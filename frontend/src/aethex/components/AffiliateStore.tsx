import React from 'react';
import { ShoppingBag, Bot, Sparkles, Link2, ExternalLink, Film, FileText, ShieldCheck } from 'lucide-react';

interface AffiliateStoreProps {
  theme: 'dark' | 'light';
  brandName?: string;
  storeUrl?: string;
  affiliateId?: string;
  onLogActivity?: (action: string) => void;
}

const PRODUCTS = [
  {
    id: 'workspace-pro',
    name: 'AethexFlow Workspace Pro',
    blurb: 'Full tool suite + higher token quota + priority bots.',
    price: '$29/mo',
    icon: Sparkles,
    tag: 'Best for operators',
  },
  {
    id: 'bot-fleet',
    name: 'Bot Fleet License',
    blurb: 'Web monitor, webhook relay, AI digest, normalizer — commercial use.',
    price: '$19/mo',
    icon: Bot,
    tag: 'Automation',
  },
  {
    id: 'video-studio',
    name: 'Video & Photo Studio',
    blurb: 'Timeline, captions, WebM export, AI edit plans.',
    price: '$15/mo',
    icon: Film,
    tag: 'Studio',
  },
  {
    id: 'secure-pack',
    name: 'Secure Pack',
    blurb: 'AES vault + PDF compressor + data formatter seat license.',
    price: '$12/mo',
    icon: ShieldCheck,
    tag: 'Privacy tools',
  },
];

export const AffiliateStore: React.FC<AffiliateStoreProps> = ({
  theme,
  brandName = 'AethexFlow',
  storeUrl = 'https://aethexflow.lemonsqueezy.com',
  affiliateId = '',
  onLogActivity,
}) => {
  const isDark = theme === 'dark';

  const checkoutUrl = (productId: string) => {
    const base = storeUrl.replace(/\/$/, '');
    const q = affiliateId ? `?aff=${encodeURIComponent(affiliateId)}` : '';
    // Lemon Squeezy product checkout pages are store-specific; affiliate query is standard LS pattern
    return `${base}/checkout/buy/${productId}${q}`;
  };

  const affiliateDashboard = affiliateId
    ? `${storeUrl.replace(/\/$/, '')}/affiliates`
    : 'https://www.lemonsqueezy.com/affiliates';

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            Sell tools & bots
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            {brandName} products on Lemon Squeezy. Affiliates earn on every qualified sale.
          </p>
        </div>
        <a
          href={affiliateDashboard}
          target="_blank"
          rel="noreferrer"
          onClick={() => onLogActivity?.('Opened Lemon Squeezy affiliate dashboard')}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
            isDark
              ? 'border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-red-500'
              : 'border-neutral-200 bg-white text-neutral-800 hover:border-red-400'
          }`}
        >
          <Link2 size={14} />
          Affiliate dashboard
          <ExternalLink size={12} />
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {PRODUCTS.map((p) => {
          const Icon = p.icon;
          return (
            <div
              key={p.id}
              className={`rounded-2xl border p-4 flex flex-col gap-3 ${
                isDark ? 'border-neutral-800 bg-[#12141c]' : 'border-neutral-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    isDark ? 'bg-red-950/50 text-red-400' : 'bg-red-50 text-red-600'
                  }`}
                >
                  <Icon size={18} />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  {p.tag}
                </span>
              </div>
              <div>
                <h3 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-neutral-900'}`}>{p.name}</h3>
                <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>{p.blurb}</p>
              </div>
              <div className="mt-auto flex items-center justify-between pt-2">
                <span className={`font-bold text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{p.price}</span>
                <a
                  href={checkoutUrl(p.id)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => onLogActivity?.(`Affiliate checkout: ${p.name}`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-colors"
                >
                  <ShoppingBag size={12} />
                  Buy / Affiliate
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className={`rounded-2xl border p-4 text-xs space-y-2 ${
          isDark ? 'border-neutral-800 bg-neutral-900/40 text-neutral-400' : 'border-neutral-200 bg-neutral-50 text-neutral-600'
        }`}
      >
        <p className="font-semibold flex items-center gap-2">
          <FileText size={14} /> How affiliates work
        </p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Lemon Squeezy affiliate program already enabled on your store.</li>
          <li>Share links with <code className="px-1 rounded bg-black/20">?aff=YOUR_ID</code> — commission tracked by LS.</li>
          <li>Set <code className="px-1 rounded bg-black/20">LEMONSQUEEZY_STORE_URL</code> + <code className="px-1 rounded bg-black/20">LEMONSQUEEZY_AFFILIATE_ID</code> in env for default branding.</li>
          <li>Replace product checkout paths with your real Lemon product URLs when live.</li>
        </ul>
      </div>
    </div>
  );
};
