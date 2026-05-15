"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Download, X, Loader2, Sparkles, Image,
  ChevronRight, Globe, AlertCircle, CheckCircle2,
  RotateCcw, ArrowRight, Shirt, User, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface TryOnResult {
  id: string;
  personImage: string;
  garmentImage: string;
  resultImage: string;
  timestamp: number;
  model: string;
}

// ─── localStorage ─────────────────────────────────────────────────────────────
const LS_TRYON_HISTORY = "sanh_tryon_history";

function loadHistory(): TryOnResult[] {
  if (typeof window === "undefined") return [];
  try {
    const v = localStorage.getItem(LS_TRYON_HISTORY);
    return v ? JSON.parse(v) : [];
  } catch { return []; }
}
function saveHistory(items: TryOnResult[]) {
  if (typeof window === "undefined") return;
  try {
    // Keep only last 10 to save space
    localStorage.setItem(LS_TRYON_HISTORY, JSON.stringify(items.slice(0, 10)));
  } catch { /* ignore */ }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function VirtualTryOn() {
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [garmentImage, setGarmentImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [history, setHistory] = useState<TryOnResult[]>(() => loadHistory());

  // ─── File Upload Handler ──────────────────────────────────────────────
  const handleUpload = useCallback((
    files: FileList | null,
    setter: (url: string) => void
  ) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) setter(e.target.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  // ─── Drop Zone Component ─────────────────────────────────────────────
  const DropZone = ({
    label, sublabel, icon: Icon, image, onUpload, onClear,
    accentFrom, accentTo, borderActive
  }: {
    label: string; sublabel: string;
    icon: React.ElementType; image: string | null;
    onUpload: (files: FileList | null) => void;
    onClear: () => void;
    accentFrom: string; accentTo: string; borderActive: string;
  }) => {
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    return (
      <div className="flex-1">
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { onUpload(e.target.files); e.target.value = ""; }} />

        {!image ? (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); onUpload(e.dataTransfer.files); }}
            className={cn(
              "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all min-h-[280px] flex flex-col items-center justify-center",
              dragOver
                ? `${borderActive} bg-opacity-10 scale-[1.02]`
                : "border-slate-200 hover:border-slate-300"
            )}
          >
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center mb-3 bg-gradient-to-br shadow-lg",
              accentFrom, accentTo
            )}>
              <Icon className="w-7 h-7 text-white" />
            </div>
            <p className="text-sm font-bold text-slate-600">{label}</p>
            <p className="text-[11px] text-slate-400 mt-1">{sublabel}</p>
            <p className="text-[10px] text-slate-300 mt-2">JPG, PNG, WebP</p>
          </div>
        ) : (
          <div className="relative group rounded-2xl overflow-hidden border-2 border-slate-200 min-h-[280px]">
            <img src={image} alt={label}
              className="w-full h-full object-contain bg-slate-50 min-h-[280px] max-h-[400px]" />
            <div className="absolute top-3 left-3">
              <span className={cn(
                "text-[10px] font-bold px-2.5 py-1 rounded-lg text-white bg-gradient-to-r shadow-sm",
                accentFrom, accentTo
              )}>
                {label}
              </span>
            </div>
            <button onClick={onClear}
              className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  };

  // ─── Generate Try-On ──────────────────────────────────────────────────
  const generateTryOn = async () => {
    if (!personImage || !garmentImage) return;

    setIsProcessing(true);
    setError(null);
    setSuggestion(null);
    setResultImage(null);
    setProgress("Đang gửi ảnh lên AI...");

    try {
      setProgress("🤖 AI đang ghép trang phục... (15-60 giây)");

      const res = await fetch("/api/tryon/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personImage, garmentImage }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Lỗi không xác định");
        if (data.suggestion) setSuggestion(data.suggestion);
        return;
      }

      if (data.resultImage) {
        setResultImage(data.resultImage);

        // Save to history
        const newResult: TryOnResult = {
          id: `tryon-${Date.now()}`,
          personImage,
          garmentImage,
          resultImage: data.resultImage,
          timestamp: Date.now(),
          model: data.model || "unknown",
        };
        const updated = [newResult, ...history].slice(0, 10);
        setHistory(updated);
        saveHistory(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi kết nối");
    } finally {
      setIsProcessing(false);
      setProgress("");
    }
  };

  // ─── Reset ────────────────────────────────────────────────────────────
  const resetAll = () => {
    setPersonImage(null);
    setGarmentImage(null);
    setResultImage(null);
    setError(null);
    setSuggestion(null);
    setProgress("");
  };

  // ─── Download Result ──────────────────────────────────────────────────
  const downloadResult = () => {
    if (!resultImage) return;
    const a = document.createElement("a");
    a.href = resultImage;
    a.download = `tryon-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const canGenerate = !!personImage && !!garmentImage && !isProcessing;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-2">
          <Globe className="h-3.5 w-3.5" />
          <span>TALPHA</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-600">Thử Đồ AI</span>
        </div>
        <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
          👗 Virtual Try-On — Thử Đồ AI
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Upload ảnh model + ảnh trang phục → AI tự động ghép → ảnh model mặc trang phục mới
        </p>
      </div>

      <div className="space-y-5">
        {/* ═══ UPLOAD SECTION ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                <Upload className="w-3.5 h-3.5 text-white" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">① Upload ảnh</h3>
            </div>
            {(personImage || garmentImage) && (
              <button onClick={resetAll}
                className="text-[10px] text-slate-400 hover:text-red-500 font-semibold flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Làm lại
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DropZone
              label="Ảnh Model" sublabel="Ảnh người mẫu / nhân vật"
              icon={User}
              image={personImage}
              onUpload={(f) => handleUpload(f, setPersonImage)}
              onClear={() => setPersonImage(null)}
              accentFrom="from-blue-500" accentTo="to-indigo-600"
              borderActive="border-blue-400"
            />

            {/* Arrow between */}
            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            </div>

            <DropZone
              label="Ảnh Trang Phục" sublabel="Ảnh quần áo (flat-lay hoặc mannequin)"
              icon={Shirt}
              image={garmentImage}
              onUpload={(f) => handleUpload(f, setGarmentImage)}
              onClear={() => setGarmentImage(null)}
              accentFrom="from-pink-500" accentTo="to-rose-600"
              borderActive="border-pink-400"
            />
          </div>

          {/* Status indicators */}
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                personImage
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-slate-100 text-slate-300"
              )}>
                {personImage ? "✓" : "1"}
              </div>
              <span className={cn("text-xs font-medium",
                personImage ? "text-emerald-600" : "text-slate-400"
              )}>Model</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-200" />
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                garmentImage
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-slate-100 text-slate-300"
              )}>
                {garmentImage ? "✓" : "2"}
              </div>
              <span className={cn("text-xs font-medium",
                garmentImage ? "text-emerald-600" : "text-slate-400"
              )}>Trang phục</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-200" />
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                resultImage
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-slate-100 text-slate-300"
              )}>
                {resultImage ? "✓" : "3"}
              </div>
              <span className={cn("text-xs font-medium",
                resultImage ? "text-emerald-600" : "text-slate-400"
              )}>Kết quả</span>
            </div>
          </div>
        </div>

        {/* ═══ GENERATE BUTTON ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">② Ghép trang phục</h3>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-4">
                <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-xs text-red-600 font-medium">{error}</span>
                  </div>
                  {suggestion && (
                    <div className="mt-2 flex items-center gap-2">
                      <a href={suggestion} target="_blank" rel="noopener noreferrer"
                        className="text-[11px] px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 font-semibold hover:bg-blue-200 transition-colors">
                        🔗 Thử trực tiếp trên HuggingFace
                      </a>
                      <button onClick={generateTryOn}
                        className="text-[11px] px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 font-semibold hover:bg-violet-200 transition-colors">
                        🔄 Thử lại
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Processing indicator */}
          {isProcessing && (
            <div className="mb-4 rounded-xl bg-violet-50 border border-violet-200 p-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full border-3 border-violet-200 border-t-violet-500 animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-bold text-violet-700">Đang xử lý...</p>
                  <p className="text-[11px] text-violet-500 mt-0.5">{progress}</p>
                </div>
              </div>
              <div className="mt-3 w-full h-1.5 bg-violet-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
            </div>
          )}

          {/* Result */}
          <AnimatePresence>
            {resultImage && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-emerald-700">🎉 Ghép trang phục thành công!</p>
                      <p className="text-[11px] text-emerald-600 mt-0.5">AI đã tạo ảnh model mặc trang phục mới</p>
                    </div>
                    <button onClick={downloadResult}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm">
                      <Download className="w-3.5 h-3.5" /> Tải ảnh
                    </button>
                  </div>

                  {/* Before/After comparison */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg overflow-hidden border border-slate-200">
                      <div className="text-[9px] font-bold text-center py-1 bg-blue-50 text-blue-600">MODEL GỐC</div>
                      {personImage && <img src={personImage} alt="Person" className="w-full h-48 object-contain bg-white" />}
                    </div>
                    <div className="rounded-lg overflow-hidden border border-slate-200">
                      <div className="text-[9px] font-bold text-center py-1 bg-pink-50 text-pink-600">TRANG PHỤC</div>
                      {garmentImage && <img src={garmentImage} alt="Garment" className="w-full h-48 object-contain bg-white" />}
                    </div>
                    <div className="rounded-lg overflow-hidden border-2 border-emerald-300 shadow-md">
                      <div className="text-[9px] font-bold text-center py-1 bg-emerald-50 text-emerald-600">⭐ KẾT QUẢ</div>
                      <img src={resultImage} alt="Result" className="w-full h-48 object-contain bg-white" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Generate button */}
          <button onClick={generateTryOn} disabled={!canGenerate}
            className={cn(
              "w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-bold transition-all",
              canGenerate
                ? "bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 text-white shadow-lg shadow-purple-200/50 hover:shadow-purple-300/60 hover:scale-[1.01]"
                : "bg-slate-100 text-slate-300 cursor-not-allowed"
            )}>
            {isProcessing ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Đang ghép trang phục...</>
            ) : (
              <><Zap className="w-5 h-5" /> {resultImage ? "Ghép lại" : "👗 Ghép Trang Phục Ngay"}</>
            )}
          </button>

          {/* Tip */}
          <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 p-2.5">
            <div className="text-[10px] text-blue-600 flex items-start gap-1.5">
              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
              <span>
                <strong>Tip:</strong> Ảnh model nên chụp thẳng, nền đơn giản. Ảnh trang phục nên flat-lay (trải phẳng) hoặc trên mannequin để AI ghép chính xác nhất. Thời gian xử lý ~15-60 giây.
              </span>
            </div>
          </div>
        </div>

        {/* ═══ HISTORY ═══ */}
        {history.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <Image className="w-3.5 h-3.5 text-white" />
                </div>
                <h3 className="text-sm font-bold text-slate-700">Lịch sử ghép gần đây</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-semibold">
                  {history.length} ảnh
                </span>
              </div>
              <button onClick={() => { setHistory([]); saveHistory([]); }}
                className="text-[10px] text-slate-400 hover:text-red-500 font-semibold">
                Xóa lịch sử
              </button>
            </div>
            <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
              {history.map((item) => (
                <button key={item.id}
                  onClick={() => setResultImage(item.resultImage)}
                  className="group relative rounded-xl overflow-hidden border border-slate-200 hover:border-purple-300 transition-all hover:shadow-md aspect-[3/4]">
                  <img src={item.resultImage} alt="Result" className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                    <p className="text-[8px] text-white font-medium">
                      {new Date(item.timestamp).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
