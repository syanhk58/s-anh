"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Download, Trash2, X, Loader2, Play, Pause,
  Plus, MousePointer2, Eraser, CheckCircle2, AlertCircle,
  Film, Eye, Scissors, RotateCcw, ZoomIn, Square,
  ChevronRight, Globe
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface RemixRegion {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

interface DrawState {
  isDrawing: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function VideoRemixer() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDimensions, setVideoDimensions] = useState({ w: 0, h: 0 });
  const [regions, setRegions] = useState<RemixRegion[]>([]);
  const [drawState, setDrawState] = useState<DrawState>({
    isDrawing: false, startX: 0, startY: 0, currentX: 0, currentY: 0,
  });
  const [isDrawMode, setIsDrawMode] = useState(true);
  const [mode, setMode] = useState<"delogo" | "blur">("delogo");
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultInfo, setResultInfo] = useState<{ duration: string; fileSize: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ─── Video upload ──────────────────────────────────────────────────────
  const handleVideoUpload = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("video/")) return;

    // Clean up previous
    if (videoUrl) URL.revokeObjectURL(videoUrl);

    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setRegions([]);
    setResultUrl(null);
    setResultInfo(null);
    setError(null);
  }, [videoUrl]);

  // ─── Video metadata loaded ─────────────────────────────────────────────
  const handleVideoLoaded = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setVideoDimensions({ w: video.videoWidth, h: video.videoHeight });
    video.pause();
    video.currentTime = 0;
    setIsPlaying(false);
  }, []);

  // ─── Toggle play/pause ─────────────────────────────────────────────────
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  // ─── Coordinate helpers ────────────────────────────────────────────────
  const getVideoCoords = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return { x: 0, y: 0 };

    const rect = container.getBoundingClientRect();
    const displayW = container.clientWidth;
    const displayH = container.clientHeight;

    // Map from display coordinates to actual video coordinates
    const scaleX = video.videoWidth / displayW;
    const scaleY = video.videoHeight / displayH;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    return {
      x: Math.max(0, Math.min(x, video.videoWidth)),
      y: Math.max(0, Math.min(y, video.videoHeight)),
    };
  };

  // ─── Drawing handlers ──────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDrawMode || !videoUrl) return;
    e.preventDefault();
    const { x, y } = getVideoCoords(e.clientX, e.clientY);
    setDrawState({ isDrawing: true, startX: x, startY: y, currentX: x, currentY: y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawState.isDrawing) return;
    e.preventDefault();
    const { x, y } = getVideoCoords(e.clientX, e.clientY);
    setDrawState(prev => ({ ...prev, currentX: x, currentY: y }));
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!drawState.isDrawing) return;
    e.preventDefault();

    const { startX, startY, currentX, currentY } = drawState;
    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const w = Math.abs(currentX - startX);
    const h = Math.abs(currentY - startY);

    // Only add if region is meaningful (at least 10x10 in video coords)
    if (w > 10 && h > 10) {
      setRegions(prev => [...prev, {
        id: `region-${Date.now()}`,
        x: Math.round(x),
        y: Math.round(y),
        w: Math.round(w),
        h: Math.round(h),
        label: `Vùng ${prev.length + 1}`,
      }]);
    }

    setDrawState({ isDrawing: false, startX: 0, startY: 0, currentX: 0, currentY: 0 });
  };

  // ─── Draw overlay on canvas ────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const video = videoRef.current;
    if (!canvas || !container || !video || !videoUrl) return;

    const displayW = container.clientWidth;
    const displayH = container.clientHeight;
    canvas.width = displayW;
    canvas.height = displayH;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, displayW, displayH);

      const scaleX = displayW / (video.videoWidth || 1);
      const scaleY = displayH / (video.videoHeight || 1);

      // Draw existing regions
      regions.forEach((r, i) => {
        const rx = r.x * scaleX;
        const ry = r.y * scaleY;
        const rw = r.w * scaleX;
        const rh = r.h * scaleY;

        // Fill
        ctx.fillStyle = "rgba(239, 68, 68, 0.2)";
        ctx.fillRect(rx, ry, rw, rh);

        // Border
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.setLineDash([]);

        // Label
        const labelText = `${i + 1}`;
        ctx.font = "bold 14px Inter, system-ui, sans-serif";
        const textWidth = ctx.measureText(labelText).width;
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.roundRect(rx, ry - 22, textWidth + 12, 20, 4);
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.fillText(labelText, rx + 6, ry - 7);
      });

      // Draw current selection
      if (drawState.isDrawing) {
        const sx = Math.min(drawState.startX, drawState.currentX) * scaleX;
        const sy = Math.min(drawState.startY, drawState.currentY) * scaleY;
        const sw = Math.abs(drawState.currentX - drawState.startX) * scaleX;
        const sh = Math.abs(drawState.currentY - drawState.startY) * scaleY;

        ctx.fillStyle = "rgba(59, 130, 246, 0.25)";
        ctx.fillRect(sx, sy, sw, sh);
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(sx, sy, sw, sh);
        ctx.setLineDash([]);
      }
    };

    draw();
  }, [regions, drawState, videoUrl, videoDimensions]);

  // Redraw on resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ─── Process video ─────────────────────────────────────────────────────
  const processVideo = async () => {
    if (!videoFile || regions.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setResultUrl(null);
    setResultInfo(null);

    try {
      const formData = new FormData();
      formData.append("video", videoFile);
      formData.append("regions", JSON.stringify(regions.map(r => ({
        x: r.x, y: r.y, w: r.w, h: r.h,
      }))));
      formData.append("mode", mode);

      const res = await fetch("/api/video/remix", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Lỗi không xác định");
        return;
      }

      setResultUrl(data.downloadUrl);
      setResultInfo({
        duration: data.duration || "",
        fileSize: data.fileSize || "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi kết nối");
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Reset ─────────────────────────────────────────────────────────────
  const resetAll = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoFile(null);
    setVideoUrl(null);
    setRegions([]);
    setResultUrl(null);
    setResultInfo(null);
    setError(null);
    setIsPlaying(false);
  };

  return (
    <div className="w-full">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-2">
          <Globe className="h-3.5 w-3.5" />
          <span>TALPHA</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-600">Xóa Logo Video</span>
        </div>
        <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Xóa Logo / Vật Thể</h2>
        <p className="text-sm text-slate-400 mt-1">Upload video → khoanh vùng logo/watermark → tự động xóa bằng FFmpeg</p>
      </div>

      <div className="space-y-5">
        {/* ═══ UPLOAD VIDEO ═══ */}
        {!videoUrl ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center">
                <Upload className="w-3.5 h-3.5 text-white" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">① Upload Video</h3>
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleVideoUpload(e.dataTransfer.files); }}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "video/mp4,video/webm,video/mov,video/avi";
                input.onchange = (e) => handleVideoUpload((e.target as HTMLInputElement).files);
                input.click();
              }}
              className={cn(
                "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all",
                dragOver ? "border-rose-400 bg-rose-50/50 scale-[1.01]" : "border-slate-200 hover:border-rose-300 hover:bg-rose-50/30"
              )}
            >
              <div className="flex flex-col items-center gap-3">
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center transition-colors",
                  dragOver ? "bg-rose-100" : "bg-slate-100"
                )}>
                  {dragOver
                    ? <Download className="w-7 h-7 text-rose-500" />
                    : <Film className="w-7 h-7 text-slate-400" />
                  }
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-600">
                    {dragOver ? "Thả video vào đây!" : "Kéo thả hoặc click để upload video"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">MP4, WebM, MOV, AVI • Tối đa 50MB</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ═══ VIDEO PREVIEW + DRAWING ═══ */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <Eye className="w-3.5 h-3.5 text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700">② Khoanh vùng cần xóa</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold">
                    {regions.length} vùng
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={resetAll}
                    className="text-[10px] text-slate-400 hover:text-red-500 font-semibold flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" /> Đổi video
                  </button>
                </div>
              </div>

              {/* Video info bar */}
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 mb-4 flex items-center gap-4 text-xs">
                <span className="text-slate-400">📁 <strong className="text-slate-600">{videoFile?.name}</strong></span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-400">{videoDimensions.w}×{videoDimensions.h}</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-400">{videoFile ? `${(videoFile.size / 1048576).toFixed(1)} MB` : ""}</span>
              </div>

              {/* Toolbar */}
              <div className="flex items-center gap-2 mb-3">
                <button onClick={togglePlay}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border",
                    "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                  )}>
                  {isPlaying
                    ? <><Pause className="w-3 h-3" /> Pause</>
                    : <><Play className="w-3 h-3" /> Play</>
                  }
                </button>
                <div className="w-px h-5 bg-slate-200" />
                <button onClick={() => setIsDrawMode(true)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border",
                    isDrawMode
                      ? "border-blue-400 bg-blue-50 text-blue-700 shadow-sm"
                      : "border-slate-200 bg-white hover:bg-blue-50 text-slate-600"
                  )}>
                  <Square className="w-3 h-3" /> Vẽ vùng
                </button>
                <button onClick={() => setIsDrawMode(false)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border",
                    !isDrawMode
                      ? "border-slate-400 bg-slate-100 text-slate-700 shadow-sm"
                      : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                  )}>
                  <MousePointer2 className="w-3 h-3" /> Di chuyển
                </button>
                <div className="w-px h-5 bg-slate-200" />
                {regions.length > 0 && (
                  <button onClick={() => setRegions(prev => prev.slice(0, -1))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-200 bg-white hover:bg-amber-50 text-slate-600 transition-all">
                    <RotateCcw className="w-3 h-3" /> Undo
                  </button>
                )}
                {regions.length > 0 && (
                  <button onClick={() => setRegions([])}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-red-200 bg-white hover:bg-red-50 text-red-500 transition-all">
                    <Eraser className="w-3 h-3" /> Xóa hết
                  </button>
                )}
              </div>

              {/* Video + Canvas Overlay */}
              <div
                ref={containerRef}
                className={cn(
                  "relative rounded-xl overflow-hidden bg-black border-2 transition-colors",
                  isDrawMode ? "border-blue-300 cursor-crosshair" : "border-slate-200 cursor-default"
                )}
                style={{ aspectRatio: videoDimensions.w && videoDimensions.h ? `${videoDimensions.w}/${videoDimensions.h}` : "16/9" }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => {
                  if (drawState.isDrawing) {
                    setDrawState(prev => ({ ...prev, isDrawing: false }));
                  }
                }}
              >
                <video
                  ref={videoRef}
                  src={videoUrl}
                  onLoadedMetadata={handleVideoLoaded}
                  className="w-full h-full object-contain"
                  muted
                  playsInline
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />
                {/* Draw mode indicator */}
                {isDrawMode && (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600/90 text-white text-[10px] font-bold backdrop-blur-sm">
                    <Square className="w-3 h-3" /> Kéo chuột để khoanh vùng logo
                  </div>
                )}
              </div>

              {/* Region list */}
              {regions.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vùng đã chọn:</p>
                  <div className="flex flex-wrap gap-2">
                    {regions.map((r, i) => (
                      <div key={r.id}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs">
                        <span className="w-4 h-4 rounded bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="text-slate-600 font-medium">
                          {r.w}×{r.h} @ ({r.x}, {r.y})
                        </span>
                        <button onClick={() => setRegions(prev => prev.filter(rr => rr.id !== r.id))}
                          className="text-red-300 hover:text-red-500 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ═══ SETTINGS & PROCESS ═══ */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <Scissors className="w-3.5 h-3.5 text-white" />
                </div>
                <h3 className="text-sm font-bold text-slate-700">③ Xử lý</h3>
              </div>

              {/* Mode selector */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button onClick={() => setMode("delogo")}
                  className={cn("p-4 rounded-xl border text-left transition-all",
                    mode === "delogo"
                      ? "border-emerald-400 bg-emerald-50/50 shadow-sm"
                      : "border-slate-200 hover:border-emerald-300"
                  )}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">✨</span>
                    <span className={cn("text-sm font-bold", mode === "delogo" ? "text-emerald-700" : "text-slate-600")}>
                      Delogo
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600 font-bold">
                      Khuyên dùng
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">Xóa thông minh, nội suy pixel xung quanh. Tốt cho logo nhỏ.</p>
                </button>

                <button onClick={() => setMode("blur")}
                  className={cn("p-4 rounded-xl border text-left transition-all",
                    mode === "blur"
                      ? "border-amber-400 bg-amber-50/50 shadow-sm"
                      : "border-slate-200 hover:border-amber-300"
                  )}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🔲</span>
                    <span className={cn("text-sm font-bold", mode === "blur" ? "text-amber-700" : "text-slate-600")}>
                      Blur
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">Làm mờ vùng chọn. Hiệu quả với vật thể lớn.</p>
                </button>
              </div>

              {/* Error message */}
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

              {/* Result */}
              <AnimatePresence>
                {resultUrl && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mb-4">
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-bold text-emerald-700">🎉 Video đã xử lý xong!</p>
                          <p className="text-[11px] text-emerald-600 mt-0.5">
                            {regions.length} vùng đã xóa
                            {resultInfo?.duration && ` • ${resultInfo.duration}`}
                            {resultInfo?.fileSize && ` • ${resultInfo.fileSize}`}
                          </p>
                        </div>
                        <a href={resultUrl} download
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm">
                          <Download className="w-3.5 h-3.5" /> Tải xuống
                        </a>
                      </div>
                      {/* Preview result */}
                      <div className="rounded-lg overflow-hidden border border-emerald-200">
                        <video
                          src={resultUrl}
                          controls
                          className="w-full max-h-[400px] object-contain bg-black"
                          playsInline
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Process button */}
              <div className="flex gap-2">
                {!isProcessing ? (
                  <button onClick={processVideo}
                    disabled={regions.length === 0}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-bold transition-all",
                      regions.length > 0
                        ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-lg shadow-emerald-200/50 hover:shadow-emerald-300/60 hover:scale-[1.01]"
                        : "bg-slate-100 text-slate-300 cursor-not-allowed"
                    )}>
                    <Scissors className="w-5 h-5" />
                    {regions.length > 0
                      ? `🚀 Xóa ${regions.length} vùng logo ngay`
                      : "Hãy khoanh vùng logo trước"
                    }
                  </button>
                ) : (
                  <button disabled
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold bg-emerald-500 text-white animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" /> Đang xử lý video...
                  </button>
                )}
              </div>

              {/* Tip */}
              <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 p-2.5">
                <div className="text-[10px] text-blue-600 flex items-start gap-1.5">
                  <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>
                    <strong>Tip:</strong> Pause video ở frame có logo rõ nhất → kéo chuột khoanh vùng quanh logo → bấm Xóa. Có thể chọn nhiều vùng cùng lúc.
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
