"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Download, X, Loader2, Sparkles, Image,
  ChevronRight, Globe, AlertCircle, CheckCircle2,
  RotateCcw, Music, Zap, Play, Key, Video, Type
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Fashion Prompt Templates ─────────────────────────────────────────────────
const FASHION_PROMPTS = [
  { id: "walk", label: "Đi bộ tự tin", emoji: "🚶‍♀️", prompt: "The model walks forward confidently on a fashion runway with elegant posture, gentle wind blowing hair, cinematic lighting, 4K quality" },
  { id: "spin", label: "Xoay người khoe đồ", emoji: "💃", prompt: "The model spins around slowly 360 degrees to showcase the outfit from all angles, smooth cinematic rotation, studio lighting" },
  { id: "pose", label: "Tạo dáng thời trang", emoji: "📸", prompt: "The model strikes multiple fashion poses naturally, subtle movements, professional photo shoot style, beautiful bokeh background" },
  { id: "street", label: "Street style", emoji: "🌆", prompt: "The model walks casually on a beautiful city street, natural movement, street fashion photography style, golden hour lighting" },
  { id: "wind", label: "Tóc bay trong gió", emoji: "💨", prompt: "Gentle wind blows through the model's hair and clothes, creating elegant flowing movement, cinematic slow motion effect" },
  { id: "catwalk", label: "Catwalk sàn diễn", emoji: "👠", prompt: "The model walks confidently on a professional fashion catwalk, spotlights, audience blur in background, high fashion runway" },
  { id: "lookbook", label: "Lookbook", emoji: "📖", prompt: "The model poses naturally for a lookbook photoshoot, switching between 3 elegant poses, soft studio lighting" },
  { id: "outdoor", label: "Ngoài trời", emoji: "🌿", prompt: "The model walks naturally in a beautiful outdoor setting, trees and flowers in background, natural sunlight, lifestyle fashion" },
];

// ─── Text Overlay Presets ─────────────────────────────────────────────────────
const TEXT_PRESETS = [
  { id: "none", label: "Không text", emoji: "⬜" },
  { id: "price", label: "Giá + Tên", emoji: "💰" },
  { id: "hashtag", label: "Hashtags", emoji: "#️⃣" },
  { id: "cta", label: "Call-to-action", emoji: "🛒" },
];

const LS_XAI_TOKEN = "sanh_xai_token";

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FashionVideo() {
  // State
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState(FASHION_PROMPTS[0]);
  const [customPrompt, setCustomPrompt] = useState(FASHION_PROMPTS[0].prompt);
  const [xaiToken, setXaiToken] = useState("");

  // Music
  const [musicFile, setMusicFile] = useState<{ name: string; dataUrl: string } | null>(null);

  // Text overlay
  const [textOverlay, setTextOverlay] = useState("none");
  const [overlayText, setOverlayText] = useState("");

  // Generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ msg: string; time: string }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(LS_XAI_TOKEN);
    if (saved) setXaiToken(saved);
  }, []);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  // ─── Upload handler ───────────────────────────────────────────────────
  const handleImageUpload = useCallback((files: FileList | null) => {
    if (!files || !files[0]) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => { if (e.target?.result) setModelImage(e.target.result as string); };
    reader.readAsDataURL(file);
  }, []);

  // ─── Generate video ───────────────────────────────────────────────────
  const generateVideo = async () => {
    if (!modelImage || !xaiToken) return;

    setIsGenerating(true);
    setError(null);
    setResultVideoUrl(null);
    setLogs([]);
    setProgressPct(0);

    // Save token
    localStorage.setItem(LS_XAI_TOKEN, xaiToken);

    try {
      setProgress("📤 Đang gửi ảnh lên server...");
      setProgressPct(10);

      const res = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: [{ data: modelImage, name: "model.jpg" }],
          textSlides: textOverlay !== "none" && overlayText ? [{
            text: overlayText,
            fontSize: "medium",
            position: "bottom",
            textColor: "#FFFFFF",
            bgColor: "#000000",
          }] : [],
          settings: {
            slideDuration: 5,
            transition: "fade",
            aspectRatio: "9:16",
            bgMusic: musicFile ? "custom" : "none",
            mode: "grok",
          },
          xaiToken,
          grokPrompt: customPrompt,
          customMusic: musicFile?.dataUrl || null,
        }),
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
              const time = new Date().toLocaleTimeString("vi-VN");
              setLogs(prev => [...prev, { msg: data.message || data.type, time }]);

              if (data.message) setProgress(data.message);
              if (data.index && data.total) setProgressPct(Math.round((data.index / data.total) * 80) + 10);
              if (data.downloadUrl) {
                setResultVideoUrl(data.downloadUrl);
                setProgressPct(100);
              }
              if (data.type === "complete") setIsGenerating(false);
              if (data.type === "error") {
                setError(data.message);
                setIsGenerating(false);
              }
            } catch { /* ignore */ }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi kết nối");
    }
    setIsGenerating(false);
  };

  const canGenerate = !!modelImage && !!xaiToken && !isGenerating;

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-2">
          <Globe className="h-3.5 w-3.5" />
          <span>TALPHA</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-600">Video Thời Trang</span>
        </div>
        <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
          🎬 Video Thời Trang AI
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Upload 1 ảnh model → AI tạo video chuyển động (đi bộ, xoay, catwalk...) → Thêm nhạc + text → Video TikTok
        </p>
      </div>

      <div className="space-y-4">
        {/* ═══ STEP 1: UPLOAD MODEL PHOTO ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                <Upload className="w-3.5 h-3.5 text-white" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">① Ảnh Model</h3>
            </div>
            {modelImage && (
              <button onClick={() => { setModelImage(null); setResultVideoUrl(null); }}
                className="text-[10px] text-slate-400 hover:text-red-500 font-semibold flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Đổi ảnh
              </button>
            )}
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { handleImageUpload(e.target.files); e.target.value = ""; }} />

          {!modelImage ? (
            <div onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleImageUpload(e.dataTransfer.files); }}
              className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center cursor-pointer hover:border-pink-300 transition-all">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center mb-3 shadow-lg">
                <Image className="w-7 h-7 text-white" />
              </div>
              <p className="text-sm font-bold text-slate-600">Upload ảnh model mặc outfit</p>
              <p className="text-[11px] text-slate-400 mt-1">Ảnh chụp toàn thân, nền đơn giản</p>
              <p className="text-[10px] text-slate-300 mt-2">JPG, PNG, WebP</p>
            </div>
          ) : (
            <div className="relative group rounded-2xl overflow-hidden border border-slate-200 max-w-xs mx-auto">
              <img src={modelImage} alt="Model" className="w-full object-contain bg-slate-50 max-h-[350px]" />
              <div className="absolute top-2 left-2">
                <span className="text-[10px] font-bold px-2 py-1 rounded-lg text-white bg-gradient-to-r from-pink-500 to-rose-600 shadow-sm">
                  ✅ Ảnh Model
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ═══ STEP 2: CHOOSE ANIMATION STYLE ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">② Chọn kiểu chuyển động</h3>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-3">
            {FASHION_PROMPTS.map(fp => (
              <button key={fp.id}
                onClick={() => { setSelectedPrompt(fp); setCustomPrompt(fp.prompt); }}
                className={cn(
                  "p-3 rounded-xl border text-center transition-all",
                  selectedPrompt.id === fp.id
                    ? "border-sky-400 bg-sky-50 shadow-sm ring-1 ring-sky-200"
                    : "border-slate-200 hover:border-sky-300"
                )}>
                <div className="text-xl mb-1">{fp.emoji}</div>
                <div className={cn("text-[10px] font-bold",
                  selectedPrompt.id === fp.id ? "text-sky-700" : "text-slate-500"
                )}>{fp.label}</div>
              </button>
            ))}
          </div>

          <textarea
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            placeholder="Mô tả cách model chuyển động..."
            rows={2}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-400/30 focus:border-sky-300 resize-none"
          />
          <p className="text-[9px] text-slate-400 mt-1">Chọn template hoặc tự nhập prompt tiếng Anh</p>
        </div>

        {/* ═══ STEP 3: MUSIC + TEXT ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Music className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">③ Nhạc nền & Text</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Music */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">🎵 Nhạc nền</label>
              <input ref={musicInputRef} type="file" accept="audio/*" className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => setMusicFile({ name: file.name, dataUrl: ev.target?.result as string });
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }} />
              <button onClick={() => musicInputRef.current?.click()}
                className={cn("w-full p-3 rounded-xl border-2 border-dashed text-center transition-all",
                  musicFile ? "border-amber-400 bg-amber-50" : "border-slate-200 hover:border-amber-300")}>
                {musicFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm">🎵</span>
                    <span className="text-[10px] font-bold text-amber-700 truncate max-w-[120px]">{musicFile.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); setMusicFile(null); }} className="text-red-400 hover:text-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="text-lg">📁</div>
                    <div className="text-[10px] font-bold text-slate-400 mt-0.5">Upload nhạc (MP3/M4A)</div>
                  </div>
                )}
              </button>
            </div>

            {/* Text overlay */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">📝 Text overlay</label>
              <div className="grid grid-cols-2 gap-1.5">
                {TEXT_PRESETS.map(t => (
                  <button key={t.id} onClick={() => setTextOverlay(t.id)}
                    className={cn("p-2 rounded-lg border text-center text-[10px] transition-all",
                      textOverlay === t.id
                        ? "border-amber-400 bg-amber-50 text-amber-700 font-bold"
                        : "border-slate-200 hover:border-amber-300 text-slate-500")}>
                    <span className="text-sm">{t.emoji}</span>
                    <div className="mt-0.5">{t.label}</div>
                  </button>
                ))}
              </div>
              {textOverlay !== "none" && (
                <input
                  value={overlayText}
                  onChange={e => setOverlayText(e.target.value)}
                  placeholder={textOverlay === "price" ? "Váy hoa 299K" : textOverlay === "hashtag" ? "#outfit #fashion #viral" : "Shop ngay link bio 🛒"}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                />
              )}
            </div>
          </div>
        </div>

        {/* ═══ STEP 4: API KEY ═══ */}
        {!xaiToken && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Key className="w-3.5 h-3.5 text-white" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">🔑 xAI API Key</h3>
            </div>
            <div className="flex gap-2">
              <input type="password" value={xaiToken} onChange={e => setXaiToken(e.target.value)}
                placeholder="xai-xxxxxxxxxxxxxxxx"
                className="flex-1 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-violet-400/30" />
              <a href="https://console.x.ai/" target="_blank" rel="noopener noreferrer"
                className="px-3 py-2 rounded-lg bg-violet-600 text-white text-[10px] font-bold hover:bg-violet-700 shrink-0">
                Lấy Key
              </a>
            </div>
            <p className="text-[9px] text-violet-500 mt-1.5">Tạo tại console.x.ai → API Keys. Model: grok-imagine-video.</p>
          </div>
        )}

        {/* ═══ STEP 5: GENERATE ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Video className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">④ Tạo Video</h3>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-4">
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="text-xs text-red-600 font-medium">{error}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress */}
          {isGenerating && (
            <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                <div>
                  <p className="text-sm font-bold text-emerald-700">Đang tạo video...</p>
                  <p className="text-[11px] text-emerald-500">{progress}</p>
                </div>
              </div>
              <div className="w-full h-2 bg-emerald-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }} />
              </div>
              {/* Log */}
              {logs.length > 0 && (
                <div className="mt-3 max-h-28 overflow-y-auto rounded-lg bg-slate-900 p-2 text-[10px] font-mono text-slate-300 space-y-0.5">
                  {logs.map((l, i) => (
                    <div key={i}><span className="text-slate-500">[{l.time}]</span> {l.msg}</div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              )}
            </div>
          )}

          {/* Result */}
          <AnimatePresence>
            {resultVideoUrl && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    <p className="text-sm font-bold text-emerald-700 flex-1">🎉 Video tạo thành công!</p>
                    <a href={resultVideoUrl} download className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm">
                      <Download className="w-3.5 h-3.5" /> Tải Video
                    </a>
                  </div>
                  <video src={resultVideoUrl} controls className="w-full max-w-sm mx-auto rounded-xl border border-slate-200" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Generate button */}
          <button onClick={generateVideo} disabled={!canGenerate}
            className={cn(
              "w-full flex items-center justify-center gap-2.5 py-4 rounded-xl text-sm font-bold transition-all",
              canGenerate
                ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-lg shadow-emerald-200/50 hover:shadow-emerald-300/60 hover:scale-[1.01]"
                : "bg-slate-100 text-slate-300 cursor-not-allowed"
            )}>
            {isGenerating ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Đang tạo video...</>
            ) : (
              <><Zap className="w-5 h-5" /> 🎬 Tạo Video Thời Trang</>
            )}
          </button>

          {!modelImage && (
            <p className="text-[10px] text-center text-slate-400 mt-2">Upload ảnh model ở bước ① trước</p>
          )}
          {modelImage && !xaiToken && (
            <p className="text-[10px] text-center text-amber-500 mt-2">⚠️ Cần nhập xAI API Key để tạo video</p>
          )}
        </div>
      </div>
    </div>
  );
}
