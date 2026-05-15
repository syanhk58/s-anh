"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video, Upload, Image, Play, Plus, Trash2, X, Download,
  ChevronRight, ChevronUp, ChevronDown, Loader2,
  Type, Music, Clock, Sparkles, AlertCircle, CheckCircle2,
  Eye, Film, Layers, Zap, Settings2, Globe, Key, Cpu
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface MediaItem {
  id: string;
  type: "image" | "video";
  name: string;
  dataUrl: string;
}

interface TextSlide {
  id: string;
  text: string;
  fontSize: "small" | "medium" | "large";
  position: "top" | "center" | "bottom";
  textColor: string;
  bgColor: string;
  bgOpacity: number;
}

interface VideoSettings {
  slideDuration: number;
  transition: "fade" | "slide" | "zoom" | "none";
  aspectRatio: "16:9" | "9:16" | "1:1";
  bgMusic: string;
  mode: "ai" | "kenburns" | "grok";
}

interface LogEntry {
  type: string;
  message: string;
  timestamp: string;
  index?: number;
  total?: number;
}

// ─── localStorage Helpers ─────────────────────────────────────────────────────
const LS_VIDEO_SETTINGS = "sanh_video_settings";
const LS_VIDEO_TEXTSLIDES = "sanh_video_textslides";
const LS_HF_TOKEN = "sanh_hf_token";
const LS_XAI_TOKEN = "sanh_xai_token";

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function saveLS<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  slideDuration: 3,
  transition: "fade",
  aspectRatio: "9:16",
  bgMusic: "none",
  mode: "kenburns",
};

const PRESET_MUSIC = [
  { id: "none", label: "Không nhạc", emoji: "🔇" },
  { id: "upbeat", label: "Energetic", emoji: "🎵" },
  { id: "chill", label: "Chill / Lo-fi", emoji: "🎶" },
  { id: "dramatic", label: "Dramatic", emoji: "🎻" },
  { id: "corporate", label: "Corporate", emoji: "💼" },
];

const TRANSITION_OPTIONS = [
  { id: "fade", label: "Fade", emoji: "✨" },
  { id: "slide", label: "Slide", emoji: "➡️" },
  { id: "zoom", label: "Zoom", emoji: "🔍" },
  { id: "none", label: "Không", emoji: "⏹️" },
];

const TEXT_COLORS = ["#FFFFFF", "#000000", "#FF6B6B", "#4ECDC4", "#FFE66D", "#A8E6CF", "#FF8A5C", "#6C5CE7"];
const BG_COLORS = ["#000000", "#FFFFFF", "#1a1a2e", "#16213e", "#0f3460", "#e94560", "#533483", "transparent"];

// Fashion prompt templates for Grok Video
const FASHION_PROMPTS = [
  { id: "walk", label: "Đi bộ tự tin", emoji: "🚶‍♀️", prompt: "The model walks forward confidently on a fashion runway with elegant posture, gentle wind blowing hair, cinematic lighting, 4K quality" },
  { id: "spin", label: "Xoay người khoe đồ", emoji: "💃", prompt: "The model spins around slowly 360 degrees to showcase the outfit from all angles, smooth cinematic rotation, studio lighting" },
  { id: "pose", label: "Tạo dáng thời trang", emoji: "📸", prompt: "The model strikes multiple fashion poses naturally, subtle movements, professional photo shoot style, beautiful bokeh background" },
  { id: "street", label: "Street style", emoji: "🌆", prompt: "The model walks casually on a beautiful city street, natural movement, street fashion photography style, golden hour lighting" },
  { id: "wind", label: "Tóc bay trong gió", emoji: "💨", prompt: "Gentle wind blows through the model's hair and clothes, creating elegant flowing movement, cinematic slow motion effect" },
  { id: "catwalk", label: "Catwalk sàn diễn", emoji: "👠", prompt: "The model walks confidently on a professional fashion catwalk, spotlights, audience blur in background, high fashion runway" },
  { id: "lookbook", label: "Lookbook chụp hình", emoji: "📖", prompt: "The model poses naturally for a lookbook photoshoot, switching between 3 elegant poses, soft studio lighting" },
  { id: "outdoor", label: "Ngoài trời tự nhiên", emoji: "🌿", prompt: "The model walks naturally in a beautiful outdoor setting, trees and flowers in background, natural sunlight, lifestyle fashion" },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function VideoCreator() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [textSlides, setTextSlides] = useState<TextSlide[]>([]);
  const [settings, setSettings] = useState<VideoSettings>(DEFAULT_VIDEO_SETTINGS);
  const [hfToken, setHfToken] = useState("");
  const [xaiToken, setXaiToken] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateLog, setGenerateLog] = useState<LogEntry[]>([]);
  const [currentClip, setCurrentClip] = useState(0);
  const [totalClips, setTotalClips] = useState(0);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const [activePreviewIdx, setActivePreviewIdx] = useState(0);
  const [dragOverMedia, setDragOverMedia] = useState(false);
  const [grokPrompt, setGrokPrompt] = useState(FASHION_PROMPTS[0].prompt);
  const [customMusicFile, setCustomMusicFile] = useState<{ name: string; dataUrl: string } | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage
  useEffect(() => {
    setSettings(loadLS<VideoSettings>(LS_VIDEO_SETTINGS, DEFAULT_VIDEO_SETTINGS));
    setTextSlides(loadLS<TextSlide[]>(LS_VIDEO_TEXTSLIDES, []));
    const savedToken = localStorage.getItem(LS_HF_TOKEN) || "";
    setHfToken(savedToken);
    const savedXaiToken = localStorage.getItem(LS_XAI_TOKEN) || "";
    setXaiToken(savedXaiToken);
  }, []);
  useEffect(() => { saveLS(LS_VIDEO_SETTINGS, settings); }, [settings]);
  useEffect(() => { saveLS(LS_VIDEO_TEXTSLIDES, textSlides); }, [textSlides]);

  // Auto-scroll log
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [generateLog]);

  // ─── Media handlers ───────────────────────────────────────────────────
  const handleFileUpload = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!isVideo && !isImage) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        setMediaItems(prev => [...prev, {
          id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: isVideo ? "video" : "image",
          name: file.name,
          dataUrl: e.target?.result as string,
        }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const removeMedia = (id: string) => setMediaItems(prev => prev.filter(m => m.id !== id));
  const moveMedia = (idx: number, dir: -1 | 1) => {
    setMediaItems(prev => {
      const next = [...prev];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= next.length) return prev;
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };

  // ─── Text slide handlers ──────────────────────────────────────────────
  const addTextSlide = () => {
    setTextSlides(prev => [...prev, {
      id: `text-${Date.now()}`,
      text: "",
      fontSize: "medium",
      position: "center",
      textColor: "#FFFFFF",
      bgColor: "#000000",
      bgOpacity: 60,
    }]);
  };
  const updateTextSlide = (id: string, patch: Partial<TextSlide>) => {
    setTextSlides(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  };
  const removeTextSlide = (id: string) => setTextSlides(prev => prev.filter(s => s.id !== id));

  // ─── Helpers ──────────────────────────────────────────────────────────
  const getAspectDimensions = () => {
    switch (settings.aspectRatio) {
      case "16:9": return { w: 320, h: 180 };
      case "9:16": return { w: 180, h: 320 };
      case "1:1": return { w: 240, h: 240 };
    }
  };

  const totalDuration = mediaItems.length * settings.slideDuration + textSlides.filter(s => s.text.trim()).length * settings.slideDuration;
  const totalSlides = mediaItems.length + textSlides.filter(s => s.text.trim()).length;
  const progressPercent = totalClips > 0 ? (currentClip / totalClips) * 100 : 0;

  // ─── Generate video (SSE) ─────────────────────────────────────────────
  const generateVideo = async () => {
    if (mediaItems.length === 0 && textSlides.filter(s => s.text.trim()).length === 0) return;

    setIsGenerating(true);
    setGenerateLog([]);
    setCurrentClip(0);
    setTotalClips(totalSlides);
    setGeneratedUrl(null);

    const controller = new AbortController();
    abortRef.current = controller;

    // Save tokens
    if (hfToken) localStorage.setItem(LS_HF_TOKEN, hfToken);
    if (xaiToken) localStorage.setItem(LS_XAI_TOKEN, xaiToken);

    try {
      const res = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: mediaItems
            .filter(m => m.type === "image")
            .map(m => ({ data: m.dataUrl, name: m.name })),
          textSlides: textSlides.filter(s => s.text.trim()).map(s => ({
            text: s.text,
            fontSize: s.fontSize,
            position: s.position,
            textColor: s.textColor,
            bgColor: s.bgColor,
          })),
          settings,
          hfToken: settings.mode === "ai" ? hfToken : null,
          xaiToken: settings.mode === "grok" ? xaiToken : null,
          grokPrompt: settings.mode === "grok" ? grokPrompt : undefined,
          customMusic: customMusicFile?.dataUrl || null,
        }),
        signal: controller.signal,
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              const timestamp = new Date().toLocaleTimeString("vi-VN");
              setGenerateLog(prev => [...prev, { ...data, timestamp }]);

              if (data.index) setCurrentClip(data.index);
              if (data.total) setTotalClips(data.total);
              if (data.downloadUrl) setGeneratedUrl(data.downloadUrl);
              if (data.type === "complete" || data.type === "error") {
                setIsGenerating(false);
              }
            } catch { /* ignore */ }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setGenerateLog(prev => [...prev, {
          type: "error",
          message: `❌ Lỗi: ${err.message}`,
          timestamp: new Date().toLocaleTimeString("vi-VN"),
        }]);
      }
    }
    setIsGenerating(false);
    abortRef.current = null;
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    setIsGenerating(false);
    setGenerateLog(prev => [...prev, {
      type: "cancelled",
      message: "⛔ Đã hủy tạo video",
      timestamp: new Date().toLocaleTimeString("vi-VN"),
    }]);
  };

  const dim = getAspectDimensions();
  const currentPreviewMedia = mediaItems[activePreviewIdx];
  const currentPreviewText = textSlides[activePreviewIdx - mediaItems.length];

  return (
    <div className="w-full">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-2">
          <Globe className="h-3.5 w-3.5" />
          <span>TALPHA</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-600">Tạo Video</span>
        </div>
        <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Tạo Video Tự Động</h2>
        <p className="text-sm text-slate-400 mt-1">Tạo video từ hình ảnh, video ngắn & text overlay — sẵn sàng đăng Facebook, Reels, TikTok</p>
      </div>

      <div className="space-y-5">
        {/* ═══ AI MODE SELECTOR ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Cpu className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Chọn chế độ tạo video</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <button onClick={() => setSettings(s => ({ ...s, mode: "kenburns" }))}
              className={cn("p-4 rounded-xl border text-left transition-all",
                settings.mode === "kenburns"
                  ? "border-emerald-400 bg-emerald-50/50 shadow-sm"
                  : "border-slate-200 hover:border-emerald-300"
              )}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg">🎞️</span>
                <span className={cn("text-sm font-bold", settings.mode === "kenburns" ? "text-emerald-700" : "text-slate-600")}>Ken Burns</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600 font-bold">FREE</span>
              </div>
              <p className="text-[10px] text-slate-400">Zoom/pan chậm trên ảnh tĩnh. FFmpeg. Nhanh (~5s/clip).</p>
            </button>
            <button onClick={() => { setSettings(s => ({ ...s, mode: "grok" })); if (!xaiToken) setShowTokenInput(true); }}
              className={cn("p-4 rounded-xl border text-left transition-all",
                settings.mode === "grok"
                  ? "border-sky-400 bg-sky-50/50 shadow-sm"
                  : "border-slate-200 hover:border-sky-300"
              )}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg">🚀</span>
                <span className={cn("text-sm font-bold", settings.mode === "grok" ? "text-sky-700" : "text-slate-600")}>Grok Video</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-600 font-bold">xAI</span>
              </div>
              <p className="text-[10px] text-slate-400">AI tạo video 720p + audio. Cần xAI key. (~30-90s/clip).</p>
            </button>
            <button onClick={() => { setSettings(s => ({ ...s, mode: "ai" })); if (!hfToken) setShowTokenInput(true); }}
              className={cn("p-4 rounded-xl border text-left transition-all",
                settings.mode === "ai"
                  ? "border-violet-400 bg-violet-50/50 shadow-sm"
                  : "border-slate-200 hover:border-violet-300"
              )}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg">🤖</span>
                <span className={cn("text-sm font-bold", settings.mode === "ai" ? "text-violet-700" : "text-slate-600")}>HF Animate</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 font-bold">HuggingFace</span>
              </div>
              <p className="text-[10px] text-slate-400">Stable Video Diffusion. Cần HF token. (~60-120s/clip).</p>
            </button>
          </div>

          {/* ═══ GROK PROMPT + FASHION TEMPLATES ═══ */}
          <AnimatePresence>
            {settings.mode === "grok" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden">
                <div className="mt-3 p-4 rounded-xl bg-sky-50 border border-sky-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                    <span className="text-xs font-bold text-sky-700">Prompt điều khiển chuyển động</span>
                  </div>

                  {/* Fashion prompt templates */}
                  <div className="grid grid-cols-4 gap-1.5 mb-3">
                    {FASHION_PROMPTS.map(fp => (
                      <button key={fp.id} onClick={() => setGrokPrompt(fp.prompt)}
                        className={cn(
                          "p-2 rounded-lg border text-center transition-all text-[10px]",
                          grokPrompt === fp.prompt
                            ? "border-sky-400 bg-sky-100 text-sky-700 font-bold shadow-sm"
                            : "border-slate-200 hover:border-sky-300 text-slate-500"
                        )}>
                        <div className="text-base mb-0.5">{fp.emoji}</div>
                        {fp.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom prompt input */}
                  <textarea
                    value={grokPrompt}
                    onChange={e => setGrokPrompt(e.target.value)}
                    placeholder="Mô tả cách model chuyển động..."
                    rows={2}
                    className="w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-400/30 resize-none"
                  />
                  <p className="text-[9px] text-sky-400 mt-1">Chọn template ở trên hoặc tự nhập prompt bằng tiếng Anh</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* xAI / Grok Token Input */}
          <AnimatePresence>
            {(settings.mode === "grok" && !xaiToken) && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden">
                <div className="mt-3 p-3 rounded-xl bg-sky-50 border border-sky-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Key className="w-3.5 h-3.5 text-sky-500" />
                    <span className="text-xs font-bold text-sky-700">xAI API Key (Grok)</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={xaiToken}
                      onChange={e => setXaiToken(e.target.value)}
                      placeholder="xai-xxxxxxxxxxxxxxxxxxxxxxxx"
                      className="flex-1 rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-400/30"
                    />
                    <a href="https://console.x.ai/" target="_blank" rel="noopener noreferrer"
                      className="px-3 py-2 rounded-lg bg-sky-600 text-white text-[10px] font-bold hover:bg-sky-700 transition-colors shrink-0">
                      Lấy Key
                    </a>
                  </div>
                  <p className="text-[9px] text-sky-500 mt-1.5">
                    Tạo API key tại console.x.ai → API Keys. Model: grok-imagine-video.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* HuggingFace Token Input */}
          <AnimatePresence>
            {(showTokenInput || (settings.mode === "ai" && !hfToken)) && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden">
                <div className="mt-3 p-3 rounded-xl bg-violet-50 border border-violet-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Key className="w-3.5 h-3.5 text-violet-500" />
                    <span className="text-xs font-bold text-violet-700">HuggingFace API Token</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={hfToken}
                      onChange={e => setHfToken(e.target.value)}
                      placeholder="hf_xxxxxxxxxxxxxxxxxxxxxxxx"
                      className="flex-1 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                    />
                    <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer"
                      className="px-3 py-2 rounded-lg bg-violet-600 text-white text-[10px] font-bold hover:bg-violet-700 transition-colors shrink-0">
                      Lấy Token
                    </a>
                  </div>
                  <p className="text-[9px] text-violet-500 mt-1.5">
                    Miễn phí tại huggingface.co/settings/tokens → "Create new token" → chọn "Read"
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ═══ UPLOAD MEDIA ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center">
                <Upload className="w-3.5 h-3.5 text-white" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">① Upload Ảnh / Video</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">{mediaItems.length} file</span>
            </div>
            {mediaItems.length > 0 && (
              <button onClick={() => setMediaItems([])} className="text-[10px] text-slate-400 hover:text-red-500 font-semibold flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Xóa hết
              </button>
            )}
          </div>

          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOverMedia(true); }}
            onDragLeave={() => setDragOverMedia(false)}
            onDrop={(e) => { e.preventDefault(); setDragOverMedia(false); handleFileUpload(e.dataTransfer.files); }}
            onClick={() => { const input = document.createElement("input"); input.type = "file"; input.multiple = true; input.accept = "image/*,video/mp4,video/webm"; input.onchange = (e) => handleFileUpload((e.target as HTMLInputElement).files); input.click(); }}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
              dragOverMedia ? "border-rose-400 bg-rose-50/50 scale-[1.01]" : "border-slate-200 hover:border-rose-300 hover:bg-rose-50/30"
            )}
          >
            <div className="flex flex-col items-center gap-2">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
                dragOverMedia ? "bg-rose-100" : "bg-slate-100"
              )}>
                {dragOverMedia ? <Download className="w-6 h-6 text-rose-500" /> : <Image className="w-6 h-6 text-slate-400" />}
              </div>
              <p className="text-sm font-bold text-slate-600">{dragOverMedia ? "Thả file vào đây!" : "Kéo thả hoặc click để upload"}</p>
              <p className="text-[11px] text-slate-400">JPG, PNG, WebP, MP4, WebM • Tối đa 50MB/file</p>
            </div>
          </div>

          {/* Media Grid */}
          {mediaItems.length > 0 && (
            <div className="grid grid-cols-8 gap-1.5 mt-4">
              {mediaItems.map((item, idx) => (
                <div key={item.id} className={cn(
                  "relative group rounded-lg overflow-hidden border-2 transition-all cursor-pointer aspect-square",
                  activePreviewIdx === idx ? "border-rose-400 shadow-md ring-2 ring-rose-200" : "border-slate-200 hover:border-rose-300"
                )} onClick={() => setActivePreviewIdx(idx)}>
                  {item.type === "image" ? (
                    <img src={item.dataUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-slate-900 flex items-center justify-center"><Play className="w-4 h-4 text-white/70" /></div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100">
                    {idx > 0 && (
                      <button onClick={(e) => { e.stopPropagation(); moveMedia(idx, -1); }} className="p-0.5 rounded bg-white/90 text-slate-700"><ChevronUp className="w-2.5 h-2.5" /></button>
                    )}
                    {idx < mediaItems.length - 1 && (
                      <button onClick={(e) => { e.stopPropagation(); moveMedia(idx, 1); }} className="p-0.5 rounded bg-white/90 text-slate-700"><ChevronDown className="w-2.5 h-2.5" /></button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); removeMedia(item.id); }} className="p-0.5 rounded bg-red-500/90 text-white"><X className="w-2.5 h-2.5" /></button>
                  </div>
                  <div className="absolute bottom-0.5 right-0.5">
                    <span className="text-[8px] font-black bg-black/60 text-white px-1 py-0.5 rounded-full">{idx + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ═══ TEXT OVERLAY + SETTINGS ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Text Overlay */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center"><Type className="w-3.5 h-3.5 text-white" /></div>
                <h3 className="text-sm font-bold text-slate-700">② Text Overlay</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 font-semibold">{textSlides.length} slide</span>
              </div>
              <button onClick={addTextSlide} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-violet-50 text-violet-600 hover:bg-violet-100 transition-all border border-violet-200">
                <Plus className="w-3 h-3" /> Thêm
              </button>
            </div>
            <div className="space-y-3 max-h-[350px] overflow-y-auto">
              {textSlides.length === 0 ? (
                <div className="text-center py-6 text-slate-300">
                  <Type className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">Thêm text để hiển thị trên video</p>
                </div>
              ) : (
                textSlides.map((slide, idx) => (
                  <div key={slide.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-violet-500">Text #{idx + 1}</span>
                      <button onClick={() => removeTextSlide(slide.id)} className="text-slate-300 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                    </div>
                    <textarea rows={2} value={slide.text} onChange={(e) => updateTextSlide(slide.id, { text: e.target.value })}
                      placeholder="Nhập text hiển thị trên video..."
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400/30 resize-none" />
                    <div className="flex items-center gap-2 flex-wrap">
                      <select value={slide.fontSize} onChange={(e) => updateTextSlide(slide.id, { fontSize: e.target.value as TextSlide["fontSize"] })}
                        className="text-[10px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-600 focus:outline-none">
                        <option value="small">Nhỏ</option><option value="medium">Vừa</option><option value="large">Lớn</option>
                      </select>
                      <select value={slide.position} onChange={(e) => updateTextSlide(slide.id, { position: e.target.value as TextSlide["position"] })}
                        className="text-[10px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-600 focus:outline-none">
                        <option value="top">Trên</option><option value="center">Giữa</option><option value="bottom">Dưới</option>
                      </select>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-slate-400">Chữ:</span>
                        <div className="flex gap-0.5">{TEXT_COLORS.map(c => (
                          <button key={c} onClick={() => updateTextSlide(slide.id, { textColor: c })}
                            className={cn("w-3.5 h-3.5 rounded-full border-2 transition-all", slide.textColor === c ? "border-violet-500 scale-125" : "border-slate-200")}
                            style={{ backgroundColor: c }} />
                        ))}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-slate-400">Nền:</span>
                        <div className="flex gap-0.5">{BG_COLORS.slice(0, 5).map(c => (
                          <button key={c} onClick={() => updateTextSlide(slide.id, { bgColor: c })}
                            className={cn("w-3.5 h-3.5 rounded-full border-2 transition-all", slide.bgColor === c ? "border-violet-500 scale-125" : "border-slate-200")}
                            style={{ backgroundColor: c === "transparent" ? "white" : c }} />
                        ))}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Video Settings */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center"><Settings2 className="w-3.5 h-3.5 text-white" /></div>
              <h3 className="text-sm font-bold text-slate-700">③ Cài đặt Video</h3>
            </div>
            <div className="space-y-4">
              {/* Aspect Ratio */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-2"><Video className="w-3 h-3" /> Tỷ lệ khung hình</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["9:16", "1:1", "16:9"] as const).map(ratio => (
                    <button key={ratio} onClick={() => setSettings(s => ({ ...s, aspectRatio: ratio }))}
                      className={cn("p-2.5 rounded-xl border text-center transition-all",
                        settings.aspectRatio === ratio ? "border-amber-400 bg-amber-50 shadow-sm" : "border-slate-200 hover:border-amber-300")}>
                      <div className={cn("text-sm font-black", settings.aspectRatio === ratio ? "text-amber-700" : "text-slate-600")}>{ratio}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">{ratio === "9:16" ? "Reels" : ratio === "1:1" ? "Instagram" : "YouTube"}</div>
                    </button>
                  ))}
                </div>
              </div>
              {/* Duration */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-2"><Clock className="w-3 h-3" /> Thời lượng / slide</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={2} max={10} step={1} value={settings.slideDuration}
                    onChange={(e) => setSettings(s => ({ ...s, slideDuration: parseFloat(e.target.value) }))}
                    className="flex-1 accent-amber-500 h-2" />
                  <span className="text-sm font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg min-w-[3rem] text-center">{settings.slideDuration}s</span>
                </div>
              </div>
              {/* Transition */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-2"><Sparkles className="w-3 h-3" /> Chuyển cảnh</label>
                <div className="grid grid-cols-4 gap-2">
                  {TRANSITION_OPTIONS.map(t => (
                    <button key={t.id} onClick={() => setSettings(s => ({ ...s, transition: t.id as VideoSettings["transition"] }))}
                      className={cn("p-2 rounded-xl border text-center transition-all",
                        settings.transition === t.id ? "border-amber-400 bg-amber-50" : "border-slate-200 hover:border-amber-300")}>
                      <div className="text-base">{t.emoji}</div>
                      <div className={cn("text-[10px] font-bold mt-0.5", settings.transition === t.id ? "text-amber-700" : "text-slate-500")}>{t.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              {/* Music */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-2"><Music className="w-3 h-3" /> Nhạc nền</label>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_MUSIC.map(m => (
                    <button key={m.id} onClick={() => setSettings(s => ({ ...s, bgMusic: m.id }))}
                      className={cn("p-2 rounded-xl border text-center transition-all",
                        settings.bgMusic === m.id ? "border-amber-400 bg-amber-50" : "border-slate-200 hover:border-amber-300")}>
                      <div className="text-sm">{m.emoji}</div>
                      <div className={cn("text-[10px] font-bold mt-0.5", settings.bgMusic === m.id ? "text-amber-700" : "text-slate-500")}>{m.label}</div>
                    </button>
                  ))}
                </div>
                {/* Custom music upload */}
                <input ref={musicInputRef} type="file" accept="audio/*" className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      setCustomMusicFile({ name: file.name, dataUrl: ev.target?.result as string });
                      setSettings(s => ({ ...s, bgMusic: "custom" }));
                    };
                    reader.readAsDataURL(file);
                    e.target.value = "";
                  }} />
                <button onClick={() => musicInputRef.current?.click()}
                  className={cn("mt-2 w-full p-2.5 rounded-xl border-2 border-dashed text-center transition-all",
                    customMusicFile ? "border-amber-400 bg-amber-50" : "border-slate-200 hover:border-amber-300")}>
                  {customMusicFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm">🎵</span>
                      <span className="text-[10px] font-bold text-amber-700 truncate max-w-[150px]">{customMusicFile.name}</span>
                      <button onClick={(e) => { e.stopPropagation(); setCustomMusicFile(null); setSettings(s => ({ ...s, bgMusic: "none" })); }}
                        className="text-red-400 hover:text-red-600">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm">📁</div>
                      <div className="text-[10px] font-bold text-slate-400 mt-0.5">Upload nhạc riêng (MP3/M4A)</div>
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ GENERATE & LOG ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center"><Zap className="w-3.5 h-3.5 text-white" /></div>
            <h3 className="text-sm font-bold text-slate-700">④ Tạo Video</h3>
          </div>

          {/* Summary */}
          <div className="rounded-xl bg-gradient-to-r from-slate-50 to-blue-50/40 border border-slate-200 p-4 mb-4">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <div className="text-[10px] text-slate-400">Slides</div>
                <div className="text-lg font-black text-slate-700">{totalSlides}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Thời lượng</div>
                <div className="text-lg font-black text-slate-700">~{totalDuration}s</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Tỷ lệ</div>
                <div className="text-lg font-black text-slate-700">{settings.aspectRatio}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Mode</div>
                <div className="text-lg font-black text-slate-700">{settings.mode === "grok" ? "🚀 Grok" : settings.mode === "ai" ? "🤖 HF" : "🎞️ KB"}</div>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {isGenerating && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Clip {currentClip}/{totalClips}
                </span>
                <span className="text-xs font-black text-emerald-600">{Math.round(progressPercent)}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          )}

          {/* Generation log */}
          {(isGenerating || generateLog.length > 0) && (
            <div className="mb-4 max-h-48 overflow-y-auto rounded-xl bg-slate-900 p-3 space-y-0.5 font-mono text-[11px]">
              {generateLog.map((log, i) => (
                <div key={i} className={cn("flex items-start gap-2", {
                  "text-emerald-400": log.type === "clip_done" || log.type === "complete",
                  "text-red-400": log.type === "error" || log.type === "clip_error",
                  "text-amber-400": log.type === "text_render" || log.type === "adding_music",
                  "text-blue-400": log.type === "clip_start" || log.type === "stitching",
                  "text-cyan-400": log.type === "info",
                  "text-slate-500": log.type === "cancelled",
                })}>
                  <span className="text-slate-600 shrink-0">{log.timestamp}</span>
                  <span>{log.message}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}

          {/* Generated result */}
          {generatedUrl && !isGenerating && (
            <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-emerald-700">🎉 Video đã tạo xong!</p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">{totalSlides} slides • {settings.aspectRatio} • ~{totalDuration}s</p>
                </div>
                <a href={generatedUrl} download
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm">
                  <Download className="w-3.5 h-3.5" /> Tải xuống
                </a>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            {!isGenerating ? (
              <button onClick={generateVideo}
                disabled={totalSlides === 0 || (settings.mode === "ai" && !hfToken) || (settings.mode === "grok" && !xaiToken)}
                className={cn("flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-bold transition-all",
                  totalSlides > 0 && !(settings.mode === "ai" && !hfToken) && !(settings.mode === "grok" && !xaiToken)
                    ? "bg-gradient-to-r from-rose-600 via-red-600 to-orange-600 text-white shadow-lg shadow-rose-200/50 hover:shadow-rose-300/60 hover:scale-[1.01]"
                    : "bg-slate-100 text-slate-300 cursor-not-allowed"
                )}>
                <Video className="w-5 h-5" />
                {generatedUrl ? "Tạo lại Video" : "🎬 Tạo Video Ngay"}
                {settings.mode === "ai" && !hfToken && " (Cần HF Token)"}
                {settings.mode === "grok" && !xaiToken && " (Cần xAI Key)"}
              </button>
            ) : (
              <button onClick={stopGeneration}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-all animate-pulse">
                <X className="w-4 h-4" /> Hủy
              </button>
            )}
          </div>

          {/* Tip */}
          <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 p-2.5">
            <div className="text-[10px] text-blue-600 flex items-start gap-1.5">
              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
              <span>
                {settings.mode === "kenburns"
                  ? <><strong>Ken Burns Mode:</strong> Chỉ cần FFmpeg, mỗi clip ~5 giây. Upload 30 ảnh = video ~2.5 phút trong ~2-3 phút xử lý.</>
                  : settings.mode === "grok"
                  ? <><strong>Grok Video:</strong> xAI Grok Imagine tạo video 720p với audio. Mỗi clip ~30-90 giây. Nếu fail sẽ tự fallback Ken Burns.</>
                  : <><strong>HF AI Mode:</strong> Mỗi clip mất 60-120 giây trên HuggingFace free tier. 30 ảnh ≈ 30-60 phút chờ. Nếu AI fail sẽ tự fallback Ken Burns.</>
                }
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
