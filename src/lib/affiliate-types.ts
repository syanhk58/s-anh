/**
 * Affiliate Video Factory — Shared Types
 */

export interface AffiliateProduct {
  id: string;
  name: string;
  affiliateLink: string;
  price: string;
  salePrice?: string;
  usp: string[];               // 3-5 bullet points
  images: ProductImage[];       // Product images (base64)
  category: string;
  targetPlatform: "tiktok" | "reels" | "youtube" | "all";
  script?: GeneratedScript;
  voiceUrl?: string;
  videoUrl?: string;
  status: ProductStatus;
}

export type ProductStatus =
  | "pending"       // Just imported
  | "scripted"      // Script generated
  | "voiced"        // Voiceover generated
  | "rendering"     // Video rendering in progress
  | "rendered"      // Video ready
  | "error";        // Something failed

export interface ProductImage {
  id: string;
  dataUrl: string;
  name: string;
}

export interface GeneratedScript {
  hook: string;           // 3s opening hook
  problem: string;        // 5s problem statement
  solution: string;       // 5s product solution
  proof: string;          // 5s social proof
  cta: string;            // 3s call-to-action
  fullText: string;       // Combined full voiceover text
  language: string;
}

export interface VideoTemplate {
  id: string;
  name: string;
  ctaText: string;
  ctaPosition: "top" | "bottom";
  priceOverlay: boolean;
  endscreen: boolean;
  subtitleStyle: "none" | "simple" | "karaoke" | "tiktok";
  musicType: string;
}

export interface BatchProgress {
  productId: string;
  productName: string;
  step: "script" | "voice" | "render" | "compose" | "done" | "error";
  message: string;
  index: number;
  total: number;
}

export const DEFAULT_TEMPLATE: VideoTemplate = {
  id: "default",
  name: "Standard Affiliate",
  ctaText: "Link ở bio 👇",
  ctaPosition: "bottom",
  priceOverlay: true,
  endscreen: true,
  subtitleStyle: "simple",
  musicType: "upbeat",
};

export const PRODUCT_CATEGORIES = [
  { id: "beauty", label: "Mỹ phẩm / Skincare", emoji: "💄" },
  { id: "health", label: "Sức khỏe / TPCN", emoji: "💊" },
  { id: "fashion", label: "Thời trang", emoji: "👗" },
  { id: "tech", label: "Công nghệ / Gadget", emoji: "📱" },
  { id: "home", label: "Gia dụng / Nhà cửa", emoji: "🏠" },
  { id: "food", label: "Thực phẩm", emoji: "🍜" },
  { id: "baby", label: "Mẹ & Bé", emoji: "👶" },
  { id: "sport", label: "Thể thao", emoji: "⚽" },
  { id: "pet", label: "Thú cưng", emoji: "🐾" },
  { id: "other", label: "Khác", emoji: "📦" },
];

export const VOICE_ENGINES = [
  { id: "edge-tts", label: "Edge TTS", emoji: "🗣️", desc: "Miễn phí, chất lượng tốt", free: true },
  { id: "gtts", label: "Google TTS", emoji: "🔊", desc: "Miễn phí, cơ bản", free: true },
  { id: "xai", label: "Grok TTS", emoji: "🚀", desc: "Cần xAI API key", free: false },
];

export const SCRIPT_LANGUAGES = [
  { id: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
  { id: "en", label: "English", flag: "🇺🇸" },
  { id: "ar", label: "العربية", flag: "🇸🇦" },
];
