"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
    Megaphone, Send, Loader2, Link2, Upload, ImageIcon,
    Video, X, Check, Copy, AlertCircle, ChevronDown,
    Search, Globe, FileText, Sparkles, Eye, Trash2
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface FbPage { id: string; name: string; accessToken: string; picture: string; }

interface MediaItem {
    id: string;
    type: "image" | "video";
    file?: File;
    url?: string;
    preview: string;
    name: string;
}

type InputMode = "adlib" | "manual";
type PostStatus = "idle" | "loading" | "success" | "error";

// ─── CopyButton ───────────────────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className={cn("flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all",
                copied ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-200")}>
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? "Đã copy!" : "Copy"}
        </button>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PagePostTool() {
    // Pages (trực tiếp từ Facebook Graph API)
    const [fbPages, setFbPages] = useState<FbPage[]>([]);
    const [selectedPage, setSelectedPage] = useState<FbPage | null>(null);
    const [loadingPages, setLoadingPages] = useState(true);

    // Page searchable dropdown
    const [pageDropdownOpen, setPageDropdownOpen] = useState(false);
    const [pageSearch, setPageSearch] = useState("");
    const pageDropdownRef = useRef<HTMLDivElement>(null);

    const filteredPages = fbPages.filter(p => {
        if (!pageSearch.trim()) return true;
        const q = pageSearch.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
    });

    // Input mode
    const [mode, setMode] = useState<InputMode>("manual");

    // Content
    const [message, setMessage] = useState("");
    const [media, setMedia] = useState<MediaItem[]>([]);

    // Ad Library
    const [adUrl, setAdUrl] = useState("");
    const [scraping, setScraping] = useState(false);
    const [scrapeError, setScrapeError] = useState("");

    // Posting
    const [postStatus, setPostStatus] = useState<PostStatus>("idle");
    const [postResult, setPostResult] = useState("");

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ─── Load FB pages on mount ───────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/facebook/page-post");
                const data = await res.json();
                if (data.fbPages && data.fbPages.length > 0) {
                    setFbPages(data.fbPages);
                    setSelectedPage(data.fbPages[0]);
                }
            } catch { /* ignore */ }
            setLoadingPages(false);
        })();
    }, []);

    // Close page dropdown on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (pageDropdownRef.current && !pageDropdownRef.current.contains(e.target as Node)) {
                setPageDropdownOpen(false);
                setPageSearch("");
            }
        }
        if (pageDropdownOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [pageDropdownOpen]);

    // ─── File upload handler ──────────────────────────────────────────────────
    const handleFiles = useCallback((files: FileList) => {
        Array.from(files).forEach(file => {
            const isVideo = file.type.startsWith("video/");
            const isImage = file.type.startsWith("image/");
            if (!isVideo && !isImage) return;

            const item: MediaItem = {
                id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                type: isVideo ? "video" : "image",
                file,
                preview: URL.createObjectURL(file),
                name: file.name,
            };
            setMedia(prev => [...prev, item]);
        });
    }, []);

    const removeMedia = (id: string) => {
        setMedia(prev => {
            const item = prev.find(m => m.id === id);
            if (item?.preview) URL.revokeObjectURL(item.preview);
            return prev.filter(m => m.id !== id);
        });
    };

    // ─── Scrape Ad Library ────────────────────────────────────────────────────
    const handleScrape = async () => {
        if (!adUrl.trim()) return;
        setScraping(true);
        setScrapeError("");
        try {
            const res = await fetch("/api/facebook/scrape-ad", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: adUrl }),
            });
            const data = await res.json();
            if (data.error) {
                setScrapeError(data.error);
            } else {
                if (data.text) setMessage(data.text);
                const newMedia: MediaItem[] = [];
                if (data.images) {
                    data.images.slice(0, 5).forEach((url: string, i: number) => {
                        newMedia.push({
                            id: `scraped-img-${Date.now()}-${i}`,
                            type: "image", url, preview: url,
                            name: `Ad Image ${i + 1}`,
                        });
                    });
                }
                if (data.videos) {
                    data.videos.slice(0, 2).forEach((url: string, i: number) => {
                        newMedia.push({
                            id: `scraped-vid-${Date.now()}-${i}`,
                            type: "video", url, preview: "",
                            name: `Ad Video ${i + 1}`,
                        });
                    });
                }
                if (newMedia.length > 0) setMedia(prev => [...prev, ...newMedia]);
            }
        } catch {
            setScrapeError("Lỗi kết nối. Kiểm tra lại mạng.");
        }
        setScraping(false);
    };

    // ─── Post to Page ─────────────────────────────────────────────────────────
    const handlePost = async () => {
        if (!selectedPage) return;
        setPostStatus("loading");
        setPostResult("");

        try {
            const formData = new FormData();
            formData.append("pageId", selectedPage.id);
            formData.append("pageToken", selectedPage.accessToken);
            formData.append("message", message);

            const hasVideo = media.some(m => m.type === "video");
            const images = media.filter(m => m.type === "image");

            if (media.length === 0) {
                formData.append("mediaType", "none");
            } else if (hasVideo) {
                formData.append("mediaType", "video");
                const vid = media.find(m => m.type === "video");
                if (vid?.file) formData.append("video", vid.file);
                else if (vid?.url) formData.append("videoUrl", vid.url);
            } else {
                formData.append("mediaType", "photo");
                images.forEach((img, i) => {
                    if (img.file) formData.append(`photo${i}`, img.file);
                    else if (img.url) formData.append(`photoUrl${i}`, img.url);
                });
            }

            const res = await fetch("/api/facebook/page-post", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();

            if (data.success) {
                setPostStatus("success");
                setPostResult(`✅ Đã đăng thành công! Post ID: ${data.postId}`);
                setTimeout(() => setPostStatus("idle"), 8000);
            } else {
                setPostStatus("error");
                setPostResult(`❌ ${data.error}`);
                setTimeout(() => setPostStatus("idle"), 5000);
            }
        } catch {
            setPostStatus("error");
            setPostResult("❌ Lỗi kết nối");
            setTimeout(() => setPostStatus("idle"), 5000);
        }
    };

    const canPost = selectedPage && (message.trim() || media.length > 0);

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="max-w-4xl mx-auto space-y-5">
            {/* HEADER */}
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-200/50">
                    <Megaphone className="h-5 w-5 text-white" />
                </div>
                <div>
                    <h1 className="text-lg font-black text-slate-800 tracking-tight">Đăng bài lên Page</h1>
                    <p className="text-xs text-slate-400">Đăng từ Ad Library hoặc upload media</p>
                </div>
            </div>

            {/* ═══ CHỌN PAGE (Facebook Pages trực tiếp) ═══ */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
                <div className="flex items-center gap-2.5 mb-4">
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <Globe className="h-3.5 w-3.5 text-white" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">① Chọn Facebook Page</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold">{fbPages.length} pages</span>
                </div>

                {loadingPages ? (
                    <div className="flex items-center gap-2 text-slate-400 py-4 justify-center">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs">Đang tải danh sách Pages từ Facebook...</span>
                    </div>
                ) : fbPages.length === 0 ? (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-amber-700">Không tìm thấy Pages</p>
                            <p className="text-xs text-amber-600 mt-1">Kiểm tra lại token Graph API. Cần scope <code className="bg-amber-100 px-1 rounded">pages_manage_posts</code></p>
                        </div>
                    </div>
                ) : (
                    <div className="relative" ref={pageDropdownRef}>
                        <button onClick={() => setPageDropdownOpen(!pageDropdownOpen)}
                            className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left",
                                pageDropdownOpen ? "border-blue-400 bg-blue-50/30 shadow-sm" : "border-slate-200 bg-slate-50/50 hover:border-slate-300")}>
                            {selectedPage?.picture && (
                                <img src={selectedPage.picture} alt="" className="w-8 h-8 rounded-lg object-cover border border-white shadow-sm" />
                            )}
                            <div className="flex-1 min-w-0">
                                {selectedPage ? (
                                    <>
                                        <div className="text-sm font-bold text-slate-700 truncate">{selectedPage.name}</div>
                                        <div className="text-[10px] text-slate-400">Page ID: {selectedPage.id}</div>
                                    </>
                                ) : (
                                    <span className="text-sm text-slate-400">Chọn page...</span>
                                )}
                            </div>
                            <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform shrink-0", pageDropdownOpen && "rotate-180")} />
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 font-bold shrink-0">✓ Token</span>
                        </button>

                        {pageDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-50 max-h-72 overflow-hidden">
                                <div className="p-2 border-b border-slate-100">
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                                        <Search className="h-3.5 w-3.5 text-slate-400" />
                                        <input value={pageSearch} onChange={e => setPageSearch(e.target.value)}
                                            placeholder="Tìm page..." autoFocus
                                            className="flex-1 text-xs bg-transparent outline-none text-slate-700 placeholder:text-slate-300" />
                                    </div>
                                </div>
                                <div className="max-h-56 overflow-y-auto p-1">
                                    {filteredPages.length === 0 ? (
                                        <div className="text-center py-3 text-xs text-slate-400">Không tìm thấy page</div>
                                    ) : (
                                        filteredPages.map(p => (
                                            <button key={p.id} onClick={() => { setSelectedPage(p); setPageDropdownOpen(false); setPageSearch(""); }}
                                                className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left",
                                                    selectedPage?.id === p.id ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50")}>
                                                {p.picture ? (
                                                    <img src={p.picture} alt="" className="w-7 h-7 rounded-lg object-cover border border-slate-100" />
                                                ) : (
                                                    <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center">
                                                        <Globe className="h-3.5 w-3.5 text-slate-400" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-bold text-slate-700 truncate">{p.name}</div>
                                                    <div className="text-[10px] text-slate-400">{p.id}</div>
                                                </div>
                                                <span className="text-[9px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-bold shrink-0">✓ Token</span>
                                                {selectedPage?.id === p.id && <Check className="h-4 w-4 text-blue-500 shrink-0" />}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ═══ INPUT MODE TABS ═══ */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="flex border-b border-slate-100">
                    {[
                        { id: "manual" as InputMode, icon: Upload, label: "Upload từ máy", desc: "Ảnh, video, text" },
                        { id: "adlib" as InputMode, icon: Link2, label: "Link Ad Library", desc: "Scrape nội dung quảng cáo" },
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setMode(tab.id)}
                            className={cn("flex-1 flex items-center justify-center gap-2.5 py-3.5 px-4 transition-all relative",
                                mode === tab.id ? "bg-white text-blue-600" : "bg-slate-50/50 text-slate-400 hover:text-slate-600")}>
                            <tab.icon className="h-4 w-4" />
                            <div className="text-left">
                                <div className="text-xs font-bold">{tab.label}</div>
                                <div className="text-[10px] opacity-60">{tab.desc}</div>
                            </div>
                            {mode === tab.id && (
                                <div className="absolute bottom-0 left-4 right-4 h-[2px] bg-blue-500 rounded-t-full" />
                            )}
                        </button>
                    ))}
                </div>

                <div className="p-5">
                    {mode === "adlib" && (
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <div className="flex-1 relative">
                                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <input value={adUrl} onChange={e => setAdUrl(e.target.value)}
                                        placeholder="Dán link Facebook Ad Library (facebook.com/ads/library/...)"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-300"
                                        onKeyDown={e => e.key === "Enter" && handleScrape()} />
                                </div>
                                <button onClick={handleScrape} disabled={!adUrl.trim() || scraping}
                                    className={cn("flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all",
                                        adUrl.trim() && !scraping ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-200/50" : "bg-slate-100 text-slate-300 cursor-not-allowed")}>
                                    {scraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                    {scraping ? "Đang scrape..." : "Lấy nội dung"}
                                </button>
                            </div>
                            {scrapeError && (
                                <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                                    <span className="text-xs text-red-600">{scrapeError}</span>
                                </div>
                            )}
                            <div className="rounded-xl bg-blue-50/50 border border-blue-100 p-3 text-[11px] text-blue-600">
                                💡 <strong>Cách dùng:</strong> Mở <a href="https://www.facebook.com/ads/library" target="_blank" rel="noopener noreferrer" className="underline font-bold">facebook.com/ads/library</a> → tìm quảng cáo → copy URL → paste.
                            </div>
                        </div>
                    )}

                    <div className={cn("space-y-4", mode === "adlib" && "mt-4")}>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-3.5 w-3.5 text-slate-400" />
                                    <span className="text-xs font-bold text-slate-600">② Nội dung bài đăng</span>
                                </div>
                                {message && <CopyBtn text={message} />}
                            </div>
                            <textarea rows={5} value={message} onChange={e => setMessage(e.target.value)}
                                placeholder="Nhập nội dung bài viết... (hoặc để trống nếu chỉ đăng media)"
                                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-300 resize-none transition-all leading-relaxed" />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <ImageIcon className="h-3.5 w-3.5 text-slate-400" />
                                    <span className="text-xs font-bold text-slate-600">③ Ảnh / Video</span>
                                    <span className="text-[10px] text-slate-400">({media.length} file)</span>
                                </div>
                                {media.length > 0 && (
                                    <button onClick={() => setMedia([])} className="text-[10px] text-slate-400 hover:text-red-500 font-semibold flex items-center gap-1">
                                        <Trash2 className="h-3 w-3" /> Xóa tất cả
                                    </button>
                                )}
                            </div>

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                                onDrop={e => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
                                className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all group"
                            >
                                <Upload className="h-6 w-6 text-slate-300 mx-auto mb-1 group-hover:text-blue-400 transition-colors" />
                                <p className="text-xs text-slate-400 group-hover:text-blue-500">
                                    Kéo thả hoặc <span className="font-bold underline">chọn file</span>
                                </p>
                                <p className="text-[10px] text-slate-300 mt-0.5">JPG, PNG, WebP, MP4, MOV</p>
                            </div>
                            <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden"
                                onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }} />

                            {media.length > 0 && (
                                <div className="grid grid-cols-4 gap-2 mt-3">
                                    {media.map(m => (
                                        <div key={m.id} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50 aspect-square">
                                            {m.type === "image" ? (
                                                <img src={m.preview} alt={m.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 gap-1">
                                                    <Video className="h-6 w-6 text-slate-400" />
                                                    <span className="text-[10px] text-slate-400 px-1 truncate max-w-full">{m.name}</span>
                                                </div>
                                            )}
                                            <button onClick={() => removeMedia(m.id)}
                                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <X className="h-3 w-3 text-white" />
                                            </button>
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/40 px-1.5 py-0.5">
                                                <span className="text-[9px] text-white truncate block">{m.type === "video" ? "🎬" : "📷"} {m.name}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ PREVIEW + POST ═══ */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
                <div className="flex items-center gap-2.5 mb-4">
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                        <Eye className="h-3.5 w-3.5 text-white" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">④ Preview & Đăng bài</h3>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/30 p-4 mb-4">
                    <div className="flex items-center gap-3 mb-3">
                        {selectedPage?.picture ? (
                            <img src={selectedPage.picture} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-sm" />
                        ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center">
                                <Globe className="h-4 w-4 text-slate-400" />
                            </div>
                        )}
                        <div>
                            <div className="text-sm font-bold text-slate-700">{selectedPage?.name || "Chưa chọn page"}</div>
                            <div className="text-[10px] text-slate-400">Vừa xong · 🌐</div>
                        </div>
                    </div>
                    {message ? (
                        <pre className="text-[13px] text-slate-600 whitespace-pre-wrap font-sans leading-relaxed mb-3">{message}</pre>
                    ) : (
                        <p className="text-xs text-slate-300 italic mb-3">Chưa có nội dung text...</p>
                    )}
                    {media.length > 0 && (
                        <div className={cn("grid gap-1 rounded-lg overflow-hidden", media.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
                            {media.slice(0, 4).map((m, i) => (
                                <div key={m.id} className={cn("relative bg-slate-200", media.length === 1 ? "aspect-video" : "aspect-square")}>
                                    {m.type === "image" ? (
                                        <img src={m.preview} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-slate-800">
                                            <Video className="h-8 w-8 text-white/50" />
                                        </div>
                                    )}
                                    {i === 3 && media.length > 4 && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                            <span className="text-white text-lg font-bold">+{media.length - 4}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {postResult && (
                    <div className={cn("rounded-xl p-3 mb-4 flex items-center gap-2 text-xs font-semibold border",
                        postStatus === "success" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-600 border-red-200")}>
                        {postStatus === "success" ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        {postResult}
                    </div>
                )}

                <button onClick={handlePost} disabled={!canPost || postStatus === "loading"}
                    className={cn("w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 shadow-lg",
                        canPost && postStatus !== "loading"
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-200/50 hover:shadow-blue-300/60 hover:scale-[1.005] active:scale-[0.995]"
                            : "bg-slate-100 text-slate-300 cursor-not-allowed shadow-none")}>
                    {postStatus === "loading" ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Đang đăng bài...</>
                    ) : (
                        <><Send className="h-4 w-4" /> Đăng bài lên {selectedPage?.name || "Page"}</>
                    )}
                </button>
            </div>
        </div>
    );
}
