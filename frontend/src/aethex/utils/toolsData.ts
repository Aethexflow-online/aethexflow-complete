export interface ToolItem {
  id: string;
  name: string;
  description: string;
  category: 'images' | 'documents' | 'text' | 'developer' | 'utilities' | 'studio';
  categoryLabel: string;
  iconName: string;
  actionKeywords: string[];
  isPinned: boolean;
  status: 'Browser' | 'Beta' | 'Local' | 'Edge';
}

export const INITIAL_TOOLS: ToolItem[] = [
  {
    id: 'video-studio',
    name: 'Video & Photo Studio',
    description:
      'AI edit plan → review → apply pipeline. Timeline, cuts, overlays, WebM export. Fully client-side with optional edge assist.',
    category: 'studio',
    categoryLabel: 'Studio',
    iconName: 'Film',
    actionKeywords: ['video', 'edit', 'timeline', 'webm', 'photo', 'studio', 'cut', 'overlay'],
    isPinned: true,
    status: 'Browser',
  },
  {
    id: 'pdf-compressor',
    name: 'PDF Compressor',
    description:
      'Strip metadata, compress object streams, and reduce size using pdf-lib. Runs entirely in the browser — no upload.',
    category: 'documents',
    categoryLabel: 'Documents',
    iconName: 'FileText',
    actionKeywords: ['pdf', 'compress', 'shrink', 'metadata', 'size', 'document'],
    isPinned: true,
    status: 'Local',
  },
  {
    id: 'bg-remover',
    name: 'Background Remover',
    description:
      'Local chroma-key cutout (corner color sample + feather). Best on solid/simple backgrounds. Transparent PNG — fully client-side, zero upload.',
    category: 'images',
    categoryLabel: 'Images',
    iconName: 'Image',
    actionKeywords: ['background', 'remove', 'bg', 'transparent', 'cutout', 'subject'],
    isPinned: true,
    status: 'Local',
  },
  {
    id: 'image-converter',
    name: 'Image Converter',
    description:
      'Convert between PNG, JPEG, WebP, AVIF. Batch resize, quality control, and EXIF stripping in one pass.',
    category: 'images',
    categoryLabel: 'Images',
    iconName: 'RefreshCw',
    actionKeywords: ['convert', 'webp', 'avif', 'jpeg', 'png', 'resize', 'format'],
    isPinned: false,
    status: 'Browser',
  },
  {
    id: 'text-translator',
    name: 'Text Translator',
    description:
      'Fast multi-language translation with tone control. Supports technical, formal, and conversational modes.',
    category: 'text',
    categoryLabel: 'Text & Language',
    iconName: 'Languages',
    actionKeywords: ['translate', 'language', 'urdu', 'english', 'locale', 'i18n'],
    isPinned: false,
    status: 'Browser',
  },
  {
    id: 'data-formatter',
    name: 'Data Formatter',
    description:
      'Normalize messy CSV / TSV / JSON. Key casing, dedupe, type coercion, and clean export for pipelines.',
    category: 'developer',
    categoryLabel: 'Developer',
    iconName: 'Braces',
    actionKeywords: ['csv', 'json', 'normalize', 'dedupe', 'format', 'clean', 'tsv'],
    isPinned: true,
    status: 'Local',
  },
  {
    id: 'crypto-vault',
    name: 'AES-256 Crypto Vault',
    description:
      'WebCrypto AES-256-GCM encrypt / decrypt. Password-derived keys, zero-knowledge, never leaves the device.',
    category: 'utilities',
    categoryLabel: 'Utilities',
    iconName: 'ShieldCheck',
    actionKeywords: ['encrypt', 'decrypt', 'aes', 'vault', 'secure', 'password', 'gcm'],
    isPinned: true,
    status: 'Local',
  },
  {
    id: 'bot-runner',
    name: 'Automation Bots',
    description:
      'Live web monitors, AI digests, webhook relays, and data normalizers. Configurable targets with real execution logs.',
    category: 'utilities',
    categoryLabel: 'Utilities',
    iconName: 'Bot',
    actionKeywords: ['bot', 'monitor', 'webhook', 'digest', 'automation', 'pipeline'],
    isPinned: false,
    status: 'Edge',
  },
];
