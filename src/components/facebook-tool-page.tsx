"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Search, Tags, Plus, Trash2, Copy, Check,
  ExternalLink, Loader2, ChevronRight, Wand2, Download,
  Users, Globe, Filter, AlertCircle, CheckCircle2,
  Clock, Play, SkipForward, RotateCw, Sparkles,
  FileText, X, MessageCircle, Save, BookOpen, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface FbProfile {
  id: string;
  name: string;
  color: string;
}

const PROFILE_COLORS = [
  { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500", label: "Xanh dương" },
  { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-200", dot: "bg-rose-500", label: "Hồng" },
  { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500", label: "Vàng" },
  { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500", label: "Xanh lá" },
  { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200", dot: "bg-purple-500", label: "Tím" },
  { bg: "bg-cyan-100", text: "text-cyan-700", border: "border-cyan-200", dot: "bg-cyan-500", label: "Cyan" },
];

interface FbGroup {
  id: string;
  name: string;
  url: string;
  status: "pending" | "done" | "skipped";
  profileId?: string;
}

interface Lead {
  id: string;
  rawText: string;
  name: string;
  need: string;
  contact: string;
  category: string;
  confidence: "high" | "medium" | "low";
  contacted?: boolean;
}

type TabId = "post" | "scrape" | "classify";

interface GroupCollection {
  id: string;
  name: string;
  groups: { name: string; url: string }[];
  createdAt: string;
}

// ─── localStorage Helpers ─────────────────────────────────────────────────────
const LS_GROUPS = "sanh_fb_groups";
const LS_LEADS = "sanh_fb_leads";
const LS_QUOTA = "sanh_fb_quota";
const LS_PROFILES = "sanh_fb_profiles";
const LS_COLLECTIONS = "sanh_fb_collections";

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function saveLS<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function getTodayQuota(): { date: string; count: number } {
  const today = new Date().toISOString().slice(0, 10);
  const q = loadLS<{ date: string; count: number }>(LS_QUOTA, { date: today, count: 0 });
  if (q.date !== today) return { date: today, count: 0 };
  return q;
}
function addQuota(n: number) {
  const q = getTodayQuota();
  q.count += n;
  saveLS(LS_QUOTA, q);
}

// ─── Templates nội dung ───────────────────────────────────────────────────────
const TEMPLATES = [
  { label: "Chia sẻ kiến thức", emoji: "📚", content: "Mình chia sẻ một kinh nghiệm mà team mình đã áp dụng rất hiệu quả:\n\n👉 [Nội dung kiến thức]\n\n✅ Kết quả: [Mô tả kết quả]\n\nAi đang gặp vấn đề tương tự thì comment hoặc inbox mình nhé! 💬" },
  { label: "Hỏi đáp tương tác", emoji: "🤔", content: "Hỏi thật nhanh: Mọi người đang gặp khó khăn gì nhất trong [lĩnh vực]?\n\n1️⃣ [Vấn đề 1]\n2️⃣ [Vấn đề 2]\n3️⃣ [Vấn đề 3]\n\nComment số của bạn, mình sẽ tư vấn chi tiết! 👇" },
  { label: "Giới thiệu sản phẩm", emoji: "🛍️", content: "🔥 [Tên sản phẩm] — Giải pháp cho [vấn đề]\n\n✅ [Ưu điểm 1]\n✅ [Ưu điểm 2]\n✅ [Ưu điểm 3]\n\n💰 Ưu đãi đặc biệt: [Khuyến mãi]\n📞 Liên hệ: [SĐT/Zalo]\n\n👉 Comment 'INFO' để nhận tư vấn chi tiết!" },
  { label: "Case study / Review", emoji: "⭐", content: "📌 Case study thực tế:\n\nKhách hàng: [Tên]\nVấn đề: [Mô tả vấn đề ban đầu]\nGiải pháp: [Cách giải quyết]\nKết quả: [Số liệu cụ thể]\n\n💬 Ai muốn đạt kết quả tương tự, inbox mình nhé!" },
];

// ─── CopyButton ───────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
        copied ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600 border border-transparent"
      )}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Đã copy!" : "Copy"}
    </button>
  );
}

// ─── Tab 1: Đăng bài nhóm (Hỗ trợ hàng loạt) ───────────────────────────────
function PostTab() {
  const [content, setContent] = useState("");
  const [groups, setGroups] = useState<FbGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupUrl, setNewGroupUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [variations, setVariations] = useState<string[]>([]);
  const [selectedVariation, setSelectedVariation] = useState(0);
  const [sessionActive, setSessionActive] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [showBulkInput, setShowBulkInput] = useState(false);
  const [delay, setDelay] = useState(3);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showFbGuide, setShowFbGuide] = useState(false);
  const [quota, setQuota] = useState({ date: "", count: 0 });
  const [profiles, setProfiles] = useState<FbProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [showProfileManager, setShowProfileManager] = useState(false);
  const [collections, setCollections] = useState<GroupCollection[]>([]);
  const [showCollections, setShowCollections] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [autoPosting, setAutoPosting] = useState(false);
  const [autoPostLog, setAutoPostLog] = useState<Array<{type: string; message: string; timestamp: string}>>([]);
  const [autoPostAbort, setAutoPostAbort] = useState<AbortController | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    setGroups(loadLS<FbGroup[]>(LS_GROUPS, []));
    setQuota(getTodayQuota());
    setProfiles(loadLS<FbProfile[]>(LS_PROFILES, []));
    setCollections(loadLS<GroupCollection[]>(LS_COLLECTIONS, []));
  }, []);

  // Save to localStorage
  useEffect(() => { saveLS(LS_GROUPS, groups); }, [groups]);
  useEffect(() => { saveLS(LS_PROFILES, profiles); }, [profiles]);
  useEffect(() => { saveLS(LS_COLLECTIONS, collections); }, [collections]);

  // Collection helpers
  const saveCollection = () => {
    if (!newCollectionName.trim() || groups.length === 0) return;
    const col: GroupCollection = {
      id: `col-${Date.now()}`,
      name: newCollectionName.trim(),
      groups: groups.map(g => ({ name: g.name, url: g.url })),
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setCollections(prev => [...prev, col]);
    setNewCollectionName("");
  };
  const loadCollection = (col: GroupCollection, mode: "replace" | "merge") => {
    const newGroups: FbGroup[] = col.groups.map((g, i) => ({
      id: `${Date.now()}-${i}`, name: g.name, url: g.url, status: "pending" as const,
    }));
    if (mode === "replace") {
      setGroups(newGroups);
    } else {
      const existingUrls = new Set(groups.map(g => g.url));
      setGroups(prev => [...prev, ...newGroups.filter(g => !existingUrls.has(g.url))]);
    }
    setShowCollections(false);
    setSessionActive(false);
  };
  const deleteCollection = (id: string) => setCollections(prev => prev.filter(c => c.id !== id));

  // Profile helpers
  const getProfileColor = (colorId: string) => PROFILE_COLORS.find(c => c.label === colorId) || PROFILE_COLORS[0];
  const addProfile = () => {
    if (!newProfileName.trim()) return;
    const colorIdx = profiles.length % PROFILE_COLORS.length;
    const p: FbProfile = { id: `p-${Date.now()}`, name: newProfileName.trim(), color: PROFILE_COLORS[colorIdx].label };
    setProfiles(prev => [...prev, p]);
    setNewProfileName("");
  };
  const removeProfile = (id: string) => {
    setProfiles(prev => prev.filter(p => p.id !== id));
    setGroups(prev => prev.map(g => g.profileId === id ? { ...g, profileId: undefined } : g));
    if (activeProfileId === id) setActiveProfileId(null);
  };
  const assignGroupToProfile = (groupId: string, profileId: string | undefined) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, profileId } : g));
  };
  const autoDistributeGroups = () => {
    if (profiles.length === 0) return;
    const unassigned = groups.filter(g => !g.profileId);
    const perProfile = Math.ceil(unassigned.length / profiles.length);
    setGroups(prev => {
      const updated = [...prev];
      let idx = 0;
      profiles.forEach((p, pi) => {
        for (let i = 0; i < perProfile && idx < unassigned.length; i++, idx++) {
          const gIdx = updated.findIndex(g => g.id === unassigned[idx].id);
          if (gIdx !== -1) updated[gIdx] = { ...updated[gIdx], profileId: p.id };
        }
      });
      return updated;
    });
  };

  // Filtered groups by active profile
  const filteredGroups = activeProfileId ? groups.filter(g => g.profileId === activeProfileId) : groups;

  const extractGroupName = (url: string, fallbackIdx: number): string => {
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      const parts = u.pathname.split("/").filter(Boolean);
      const groupIdx = parts.indexOf("groups");
      if (groupIdx !== -1 && parts[groupIdx + 1]) {
        const raw = parts[groupIdx + 1].replace(/-/g, " ").replace(/\d{10,}/g, "").trim();
        if (raw) return raw;
      }
    } catch { /* ignore */ }
    return `Nhóm ${fallbackIdx + 1}`;
  };

  const addGroup = () => {
    if (!newGroupUrl.trim()) return;
    const url = newGroupUrl.trim();
    const name = newGroupName.trim() || extractGroupName(url, groups.length);
    setGroups(prev => [...prev, { id: Date.now().toString(), name, url, status: "pending" }]);
    setNewGroupName("");
    setNewGroupUrl("");
  };

  const bulkAddGroups = () => {
    const lines = bulkInput.split("\n").map(l => l.trim()).filter(l => l.length > 5);
    const newGroups: FbGroup[] = [];
    lines.forEach((line, i) => {
      const parts = line.split("|").map(p => p.trim());
      let name = "", url = "";
      if (parts.length >= 2) { name = parts[0]; url = parts[1]; }
      else { url = parts[0]; name = extractGroupName(url, groups.length + i); }
      if (url.includes("facebook.com") || url.includes("fb.com")) {
        newGroups.push({ id: `${Date.now()}-${i}`, name: name || `Nhóm ${groups.length + i + 1}`, url, status: "pending" });
      }
    });
    if (newGroups.length > 0) {
      setGroups(prev => [...prev, ...newGroups]);
      setBulkInput("");
      setShowBulkInput(false);
    }
  };

  const removeGroup = (id: string) => setGroups(prev => prev.filter(g => g.id !== id));
  const clearAllGroups = () => { setGroups([]); setSessionActive(false); };

  const generateVariations = async () => {
    if (!content.trim()) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/facebook/vary-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (data.variations) { setVariations(data.variations); setSelectedVariation(0); }
    } catch { setVariations([content]); }
    setIsGenerating(false);
  };

  const pendingGroups = filteredGroups.filter(g => g.status === "pending");
  const doneCount = filteredGroups.filter(g => g.status === "done").length;
  const skippedCount = filteredGroups.filter(g => g.status === "skipped").length;
  const currentGroup = pendingGroups[0];

  const getPostContent = useCallback(() => {
    return variations.length > 0 ? variations[selectedVariation % variations.length] : content;
  }, [variations, selectedVariation, content]);

  const openNextGroup = () => {
    if (!currentGroup) return;
    navigator.clipboard.writeText(getPostContent());
    window.open(currentGroup.url, "_blank");
    setSessionActive(true);
  };

  const markDone = () => {
    if (!currentGroup) return;
    setGroups(prev => prev.map(g => g.id === currentGroup.id ? { ...g, status: "done" } : g));
    if (variations.length > 0) setSelectedVariation(prev => prev + 1);
    addQuota(1);
    setQuota(getTodayQuota());
  };

  const markSkipped = () => {
    if (!currentGroup) return;
    setGroups(prev => prev.map(g => g.id === currentGroup.id ? { ...g, status: "skipped" } : g));
  };

  const markDoneAndNext = () => {
    markDone();
    const nextPending = pendingGroups[1];
    if (nextPending && content.trim()) {
      setTimeout(() => {
        const pc = variations.length > 0 ? variations[(selectedVariation + 1) % variations.length] : content;
        navigator.clipboard.writeText(pc);
        window.open(nextPending.url, "_blank");
      }, delay * 1000);
    }
  };

  const resetSession = () => {
    setGroups(prev => prev.map(g => activeProfileId ? (g.profileId === activeProfileId ? { ...g, status: "pending" } : g) : { ...g, status: "pending" }));
    setSessionActive(false);
    setSelectedVariation(0);
  };

  const exportGroupList = () => {
    const text = filteredGroups.map(g => `${g.name} | ${g.url}`).join("\n");
    navigator.clipboard.writeText(text);
  };

  // ─── Auto Post Logic ──────────────────────────────────────────────────
  const startAutoPost = async () => {
    if (!content.trim() || pendingGroups.length === 0) return;
    const controller = new AbortController();
    setAutoPostAbort(controller);
    setAutoPosting(true);
    setAutoPostLog([]);
    const postData = {
      content: getPostContent(),
      groups: pendingGroups.map(g => ({ name: g.name, url: g.url })),
      delay,
      variations: variations.length > 0 ? variations : [],
    };
    const pendingIds = pendingGroups.map(g => g.id);
    try {
      const res = await fetch('/api/facebook/auto-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
        signal: controller.signal,
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const timestamp = new Date().toLocaleTimeString('vi-VN');
              setAutoPostLog(prev => [...prev, { ...data, timestamp }]);
              if (data.type === 'group_done' && pendingIds[data.index]) {
                const gId = pendingIds[data.index];
                setGroups(prev => prev.map(g => g.id === gId ? { ...g, status: 'done' as const } : g));
                addQuota(1);
              } else if (data.type === 'group_error' && pendingIds[data.index]) {
                const gId = pendingIds[data.index];
                setGroups(prev => prev.map(g => g.id === gId ? { ...g, status: 'skipped' as const } : g));
              } else if (data.type === 'complete' || data.type === 'error') {
                setAutoPosting(false);
                setQuota(getTodayQuota());
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        const timestamp = new Date().toLocaleTimeString('vi-VN');
        setAutoPostLog(prev => [...prev, { type: 'error', message: `❌ Lỗi kết nối: ${err.message}`, timestamp }]);
      }
    }
    setAutoPosting(false);
    setAutoPostAbort(null);
  };

  const stopAutoPost = () => {
    if (autoPostAbort) {
      autoPostAbort.abort();
      setAutoPostAbort(null);
    }
    setAutoPosting(false);
    const timestamp = new Date().toLocaleTimeString('vi-VN');
    setAutoPostLog(prev => [...prev, { type: 'cancelled', message: '⛔ Đã dừng tự động đăng bài.', timestamp }]);
  };

  const postContent = getPostContent();
  const progressPercent = filteredGroups.length > 0 ? (doneCount / filteredGroups.length) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* Quota Warning */}
      {quota.count > 0 && (
        <div className={cn("rounded-xl p-3 flex items-center gap-2 text-xs font-semibold border",
          quota.count >= 20 ? "bg-red-50 text-red-600 border-red-200" :
          quota.count >= 15 ? "bg-amber-50 text-amber-600 border-amber-200" :
          "bg-emerald-50 text-emerald-600 border-emerald-200"
        )}>
          <Shield className="w-4 h-4 shrink-0" />
          <span>Hôm nay: {quota.count}/20 nhóm đã đăng</span>
          {quota.count >= 20 && <span className="ml-auto text-[10px] text-red-500">⚠️ ĐẠT GIỚI HẠN — Nên dừng lại!</span>}
          {quota.count >= 15 && quota.count < 20 && <span className="ml-auto text-[10px] text-amber-500">Gần đạt giới hạn</span>}
        </div>
      )}

      {/* ═══ QUẢN LÝ TÀI KHOẢN FACEBOOK ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Tài khoản Facebook</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">{profiles.length} tài khoản</span>
          </div>
          <button onClick={() => setShowProfileManager(!showProfileManager)}
            className="text-[10px] text-slate-400 hover:text-slate-600 font-semibold flex items-center gap-1">
            {showProfileManager ? "Ẩn" : "Quản lý"}
          </button>
        </div>

        {/* Profile tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setActiveProfileId(null)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
              !activeProfileId ? "bg-slate-800 text-white border-slate-800" : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-400")}>
            Tất cả ({groups.length})
          </button>
          {profiles.map(p => {
            const c = getProfileColor(p.color);
            const count = groups.filter(g => g.profileId === p.id).length;
            return (
              <button key={p.id} onClick={() => setActiveProfileId(activeProfileId === p.id ? null : p.id)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5",
                  activeProfileId === p.id ? `${c.bg} ${c.text} ${c.border}` : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-400")}>
                <div className={cn("w-2 h-2 rounded-full", c.dot)} />
                {p.name} ({count})
              </button>
            );
          })}
          {groups.filter(g => !g.profileId).length > 0 && profiles.length > 0 && (
            <span className="text-[10px] text-amber-500 font-semibold">
              ⚠️ {groups.filter(g => !g.profileId).length} nhóm chưa gán
            </span>
          )}
        </div>

        {/* Profile manager */}
        <AnimatePresence>
          {showProfileManager && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                {/* Explanation */}
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 space-y-2">
                  <div className="text-[11px] font-bold text-blue-700">💡 Cách hoạt động:</div>
                  <div className="text-[10px] text-blue-600 space-y-1">
                    <p>Mỗi &quot;tài khoản&quot; tương ứng với 1 <strong>Chrome Profile</strong> đã đăng nhập Facebook.</p>
                    <p><strong>Cách thiết lập Chrome Profile:</strong></p>
                    <div className="bg-white/70 rounded-md p-2 space-y-1 text-[10px]">
                      <p>1️⃣ Click <strong>avatar</strong> góc trên bên phải Chrome</p>
                      <p>2️⃣ Click <strong>&quot;Thêm&quot;</strong> (hoặc &quot;Add&quot;) để tạo profile mới</p>
                      <p>3️⃣ Đặt tên (vd: &quot;FB Shop 1&quot;) → mở Facebook → đăng nhập tài khoản tương ứng</p>
                      <p>4️⃣ Lặp lại cho mỗi tài khoản FB</p>
                    </div>
                    <p>Khi đăng bài: click tab TK → mở Chrome Profile tương ứng → đăng bài → chuyển TK tiếp.</p>
                  </div>
                </div>

                {profiles.map(p => {
                  const c = getProfileColor(p.color);
                  return (
                    <div key={p.id} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border", c.bg, c.border)}>
                      <div className={cn("w-3 h-3 rounded-full", c.dot)} />
                      <span className={cn("text-xs font-bold flex-1", c.text)}>{p.name}</span>
                      <span className="text-[10px] text-slate-400">{groups.filter(g => g.profileId === p.id).length} nhóm</span>
                      <button onClick={() => removeProfile(p.id)} className="text-slate-300 hover:text-red-400"><X className="w-3 h-3" /></button>
                    </div>
                  );
                })}
                <div className="flex gap-2">
                  <input value={newProfileName} onChange={e => setNewProfileName(e.target.value)} placeholder="Tên tài khoản FB (vd: FB Cá nhân, FB Shop...)"
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                    onKeyDown={e => e.key === "Enter" && addProfile()} />
                  <button onClick={addProfile} className="px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                {profiles.length > 0 && groups.filter(g => !g.profileId).length > 0 && (
                  <button onClick={autoDistributeGroups}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-bold hover:opacity-90 transition-all">
                    <Sparkles className="w-3.5 h-3.5" /> Tự động chia đều {groups.filter(g => !g.profileId).length} nhóm cho {profiles.length} tài khoản
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">① Nội dung bài đăng</h3>
          </div>
          <button onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all">
            <BookOpen className="w-3 h-3" /> Mẫu bài viết
          </button>
        </div>

        {/* Templates */}
        {showTemplates && (
          <div className="grid grid-cols-4 gap-2 mb-3">
            {TEMPLATES.map((t, i) => (
              <button key={i} onClick={() => { setContent(t.content); setShowTemplates(false); }}
                className="text-left p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all">
                <div className="text-sm mb-1">{t.emoji}</div>
                <div className="text-[11px] font-bold text-slate-700">{t.label}</div>
              </button>
            ))}
          </div>
        )}

        <textarea rows={4} value={content} onChange={e => setContent(e.target.value)}
          placeholder="Soạn nội dung bài viết muốn đăng lên các nhóm..."
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-300 resize-none transition-all" />
        <div className="flex items-center gap-2 mt-3">
          <button onClick={generateVariations} disabled={!content.trim() || isGenerating}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
              content.trim() && !isGenerating ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-200/50 hover:shadow-violet-300/60" : "bg-slate-100 text-slate-300 cursor-not-allowed")}>
            {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            AI tạo {variations.length > 0 ? "lại" : ""} 3 biến thể
          </button>
          {content && <CopyButton text={postContent} />}
        </div>

        {/* Variations inline */}
        {variations.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-violet-600">✨ {variations.length} biến thể AI tạo</span>
              <span className="text-[11px] text-slate-400">Mỗi nhóm dùng 1 biến thể khác nhau</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {variations.map((v, i) => (
                <div key={i} className={cn("rounded-xl border p-3 cursor-pointer transition-all",
                  selectedVariation % variations.length === i ? "border-violet-300 bg-violet-50/50" : "border-slate-200 hover:border-violet-200"
                )} onClick={() => setSelectedVariation(i)}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-violet-500">Biến thể {i + 1}</span>
                    <CopyButton text={v} />
                  </div>
                  <p className="text-[10px] text-slate-600 line-clamp-2">{v}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ HÀNG 2: DANH SÁCH NHÓM ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">② Danh sách nhóm ({groups.length})</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowCollections(!showCollections); setShowFbGuide(false); setShowBulkInput(false); }}
              className={cn("text-[10px] font-semibold flex items-center gap-1 px-2 py-1 rounded-lg transition-all border",
                showCollections ? "bg-amber-100 text-amber-700 border-amber-300" : "text-amber-600 bg-amber-50 hover:bg-amber-100 border-amber-200")}>
              <Save className="w-3 h-3" /> Thư mục {collections.length > 0 && `(${collections.length})`}
            </button>
            <button onClick={() => { setShowFbGuide(!showFbGuide); setShowBulkInput(false); setShowCollections(false); }}
              className={cn("text-[10px] font-semibold flex items-center gap-1 px-2 py-1 rounded-lg transition-all border",
                showFbGuide ? "bg-cyan-100 text-cyan-700 border-cyan-300" : "text-cyan-500 bg-cyan-50 hover:bg-cyan-100 border-cyan-200")}>
              <Globe className="w-3 h-3" /> Auto
            </button>
            <button onClick={() => { setShowBulkInput(!showBulkInput); setShowFbGuide(false); setShowCollections(false); }}
              className={cn("text-[10px] font-semibold flex items-center gap-1 px-2 py-1 rounded-lg transition-all border",
                showBulkInput ? "bg-indigo-100 text-indigo-700 border-indigo-300" : "text-indigo-500 bg-indigo-50 hover:bg-indigo-100 border-indigo-200")}>
              <Plus className="w-3 h-3" /> Paste
            </button>
            {groups.length > 0 && (
              <>
                <button onClick={exportGroupList} className="text-[10px] text-slate-400 hover:text-blue-600 font-semibold"><Copy className="w-3 h-3" /></button>
                <button onClick={clearAllGroups} className="text-[10px] text-slate-400 hover:text-red-500 font-semibold"><Trash2 className="w-3 h-3" /></button>
              </>
            )}
          </div>
        </div>

        {/* Collections / Thư mục */}
        <AnimatePresence>
          {showCollections && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="mb-3 rounded-xl border border-amber-200 bg-amber-50/30 p-3 overflow-hidden">
              
              {/* Save current */}
              {groups.length > 0 && (
                <div className="flex gap-2 mb-3">
                  <input value={newCollectionName} onChange={e => setNewCollectionName(e.target.value)}
                    placeholder="Đặt tên thư mục (VD: Nhóm BĐS, Marketing...)"
                    className="flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                    onKeyDown={e => e.key === "Enter" && saveCollection()} />
                  <button onClick={saveCollection} disabled={!newCollectionName.trim()}
                    className={cn("px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1",
                      newCollectionName.trim() ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-slate-100 text-slate-300 cursor-not-allowed")}>
                    <Save className="w-3 h-3" /> Lưu {groups.length} nhóm
                  </button>
                </div>
              )}

              {/* List collections */}
              {collections.length > 0 ? (
                <div className="space-y-1.5">
                  {collections.map(col => (
                    <div key={col.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-amber-100 hover:border-amber-300 transition-all">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-700">📁 {col.name}</div>
                        <div className="text-[10px] text-slate-400">{col.groups.length} nhóm • {col.createdAt}</div>
                      </div>
                      <button onClick={() => loadCollection(col, "replace")}
                        className="text-[10px] px-2 py-1 rounded-md bg-blue-50 text-blue-600 font-bold hover:bg-blue-100 transition-colors border border-blue-200">
                        Tải
                      </button>
                      <button onClick={() => loadCollection(col, "merge")}
                        className="text-[10px] px-2 py-1 rounded-md bg-emerald-50 text-emerald-600 font-bold hover:bg-emerald-100 transition-colors border border-emerald-200">
                        Gộp
                      </button>
                      <button onClick={() => deleteCollection(col.id)}
                        className="text-slate-300 hover:text-red-400 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-[11px] text-slate-400 py-2">
                  Chưa có thư mục nào. Thêm nhóm rồi lưu lại để dùng lần sau!
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* FB Guide - Compact */}
        <AnimatePresence>
          {showFbGuide && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="mb-3 rounded-xl border border-cyan-200 bg-cyan-50/50 p-3 overflow-hidden">
              <div className="flex items-center gap-3 mb-2">
                <a href={`javascript:void(function(){var links=[...document.querySelectorAll('a[href*="/groups/"]')].map(a=>a.href).filter((v,i,s)=>v.includes('/groups/')&&!v.includes('/groups/feed')&&!v.includes('/groups/joins')&&!v.includes('/groups/discover')&&s.indexOf(v)===i);if(links.length===0){alert('Không tìm thấy nhóm!')}else{navigator.clipboard.writeText(links.join(String.fromCharCode(10))).then(()=>alert('✅ Đã copy '+links.length+' nhóm!'))}})();`}
                  onClick={(e) => e.preventDefault()} draggable
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[11px] font-bold shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all select-none shrink-0">
                  <Globe className="w-3 h-3" /> 📋 Lấy nhóm FB
                </a>
                <span className="text-[10px] text-slate-500">← Kéo thả lên thanh bookmark → mở <a href="https://www.facebook.com/groups/joins" target="_blank" rel="noopener noreferrer" className="text-cyan-600 underline">fb.com/groups/joins</a> → click bookmark</span>
              </div>
              <button onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  const lines = text.split("\n").map(l => l.trim()).filter(l => l.includes("facebook.com/groups/") || l.includes("fb.com/groups/"));
                  if (lines.length === 0) { alert("Clipboard không có link nhóm."); return; }
                  const newGroups: FbGroup[] = lines.map((url, i) => ({ id: `${Date.now()}-${i}`, name: extractGroupName(url, groups.length + i), url, status: "pending" as const }));
                  setGroups(prev => [...prev, ...newGroups]);
                  setShowFbGuide(false);
                  alert(`✅ Đã thêm ${newGroups.length} nhóm!`);
                } catch { alert("Không đọc được clipboard."); }
              }} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-cyan-600 text-white text-xs font-bold hover:bg-cyan-700 transition-all">
                <Download className="w-3.5 h-3.5" /> Dán từ clipboard
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Paste hàng loạt - Compact */}
        <AnimatePresence>
          {showBulkInput && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-3">
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
                <textarea rows={3} value={bulkInput} onChange={e => setBulkInput(e.target.value)}
                  placeholder={`Mỗi dòng 1 link. VD:\nhttps://facebook.com/groups/abc123\nTên nhóm | https://facebook.com/groups/xyz`}
                  className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 resize-none" />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-slate-400">{bulkInput.split("\n").filter(l => l.trim().length > 5).length} link</span>
                  <button onClick={bulkAddGroups} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors">
                    <Plus className="w-3 h-3" /> Thêm
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-1.5 mb-3 max-h-48 overflow-y-auto">
          {filteredGroups.map((g, idx) => {
            const gProfile = profiles.find(p => p.id === g.profileId);
            const gColor = gProfile ? getProfileColor(gProfile.color) : null;
            return (
              <div key={g.id} className={cn("flex items-center gap-2 p-2 rounded-lg border transition-all",
                g.status === "done" ? "bg-emerald-50/50 border-emerald-100" : g.status === "skipped" ? "bg-amber-50/50 border-amber-100" : "bg-slate-50 border-slate-100")}>
                <span className="text-[10px] text-slate-300 font-mono w-5 text-right shrink-0">{idx + 1}</span>
                <div className={cn("w-2 h-2 rounded-full shrink-0", { "bg-slate-300": g.status === "pending", "bg-emerald-400": g.status === "done", "bg-amber-400": g.status === "skipped" })} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-700 truncate">{g.name}</span>
                    {gProfile && gColor && (
                      <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0", gColor.bg, gColor.text)}>{gProfile.name}</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">{g.url}</div>
                </div>
                {profiles.length > 0 && (
                  <select value={g.profileId || ""} onChange={e => assignGroupToProfile(g.id, e.target.value || undefined)}
                    className="text-[10px] rounded border border-slate-200 bg-white px-1 py-0.5 text-slate-500 focus:outline-none shrink-0 w-16">
                    <option value="">—</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
                {g.status !== "pending" && (
                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0",
                    { "bg-emerald-100 text-emerald-600": g.status === "done", "bg-amber-100 text-amber-600": g.status === "skipped" })}>
                    {g.status === "done" ? "✓" : "—"}
                  </span>
                )}
                <button onClick={() => removeGroup(g.id)} className="text-slate-300 hover:text-red-400 transition-colors shrink-0"><X className="w-3.5 h-3.5" /></button>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Tên nhóm (tùy chọn)"
            className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/30" />
          <input value={newGroupUrl} onChange={e => setNewGroupUrl(e.target.value)} placeholder="Link nhóm Facebook"
            className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/30"
            onKeyDown={e => e.key === "Enter" && addGroup()} />
          <button onClick={addGroup} className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"><Plus className="w-4 h-4" /></button>
        </div>
      </div>

      {/* ═══ HÀNG 3: TIẾN ĐỘ ĐĂNG BÀI ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Send className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">③ Tiến độ đăng bài</h3>
            {activeProfileId && profiles.find(p => p.id === activeProfileId) && (() => {
              const ap = profiles.find(p => p.id === activeProfileId)!;
              const ac = getProfileColor(ap.color);
              return <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", ac.bg, ac.text)}>🔑 {ap.name}</span>;
            })()}
          </div>
          <button onClick={resetSession} className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1">
            <RotateCw className="w-3 h-3" /> Reset
          </button>
        </div>

        {activeProfileId && profiles.find(p => p.id === activeProfileId) && (
          <div className="mb-3 rounded-xl bg-amber-50 border border-amber-200 overflow-hidden">
            <div className="p-2.5 flex items-center gap-2 text-[11px] text-amber-700 font-semibold">
              <Shield className="w-3.5 h-3.5 shrink-0" />
              <div>
                <span>🔑 Hãy mở trình duyệt với tài khoản <strong>{profiles.find(p => p.id === activeProfileId)?.name}</strong></span>
                <div className="text-[10px] text-amber-600/80 font-normal mt-0.5">
                  💡 Mẹo: Dùng <strong>Chrome Profile</strong> — Mỗi profile đăng nhập 1 FB khác nhau. 
                  Click avatar góc trên phải Chrome → <strong>&quot;Thêm&quot;</strong> để tạo profile mới.
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: "Tổng nhóm", value: filteredGroups.length, color: "text-slate-700" },
            { label: "Đã đăng", value: doneCount, color: "text-emerald-600" },
            { label: "Bỏ qua", value: skippedCount, color: "text-amber-500" },
            { label: "Còn lại", value: pendingGroups.length, color: "text-blue-600" },
          ].map(s => (
            <div key={s.label} className="bg-slate-50 rounded-xl p-2.5 text-center">
              <div className={cn("text-xl font-black", s.color)}>{s.value}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-1">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="text-right text-[10px] text-slate-400 mb-4">{Math.round(progressPercent)}%</div>

        <div className="flex items-center gap-3 mb-4 p-2.5 bg-blue-50/50 rounded-xl border border-blue-100">
          <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span className="text-[11px] text-blue-600 font-medium">Delay giữa các nhóm:</span>
          <select value={delay} onChange={e => setDelay(Number(e.target.value))}
            className="text-xs border border-blue-200 rounded-lg px-2 py-1 bg-white text-blue-700 focus:outline-none">
            <option value={2}>2 giây</option><option value={3}>3 giây</option><option value={5}>5 giây</option><option value={8}>8 giây</option><option value={10}>10 giây</option>
          </select>
        </div>

        {currentGroup ? (
          <div className="space-y-3">
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-blue-400 font-semibold mb-1">NHÓM TIẾP THEO ({groups.length - pendingGroups.length + 1}/{groups.length})</div>
                {variations.length > 0 && (
                  <span className="text-[10px] bg-blue-100 text-blue-500 font-bold px-2 py-0.5 rounded-full">Biến thể {(selectedVariation % variations.length) + 1}</span>
                )}
              </div>
              <div className="font-semibold text-slate-700 text-sm">{currentGroup.name}</div>
              <div className="text-[11px] text-slate-400 truncate mt-0.5">{currentGroup.url}</div>
            </div>
            <div className="flex gap-2">
              {!autoPosting ? (
                <>
                  <button onClick={openNextGroup} disabled={!content.trim() || autoPosting}
                    className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all",
                      content.trim() && !autoPosting ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:shadow-lg" : "bg-slate-100 text-slate-300 cursor-not-allowed")}>
                    <Play className="w-4 h-4" /> Mở nhóm & Copy nội dung
                  </button>
                  <button onClick={startAutoPost} disabled={!content.trim() || pendingGroups.length === 0}
                    className={cn("flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all",
                      content.trim() && pendingGroups.length > 0 ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-200/50 hover:shadow-violet-300/60" : "bg-slate-100 text-slate-300 cursor-not-allowed")}>
                    <Sparkles className="w-4 h-4" /> 🤖 Auto đăng
                  </button>
                </>
              ) : (
                <button onClick={stopAutoPost}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-md hover:shadow-lg transition-all animate-pulse">
                  <X className="w-4 h-4" /> ⛔ Dừng tự động đăng
                </button>
              )}
            </div>
            {sessionActive && (
              <div className="flex gap-2">
                <button onClick={markDoneAndNext} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-all">
                  <CheckCircle2 className="w-3.5 h-3.5" /> ✅ Đã đăng → Mở tiếp
                </button>
                <button onClick={markDone} className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100 transition-all" title="Đánh dấu đã đăng">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={markSkipped} className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-amber-50 text-amber-500 border border-amber-200 hover:bg-amber-100 transition-all">
                  <SkipForward className="w-3.5 h-3.5" /> Bỏ qua
                </button>
              </div>
            )}
          </div>
        ) : groups.length > 0 ? (
          <div className="text-center py-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-emerald-600">🎉 Hoàn thành tất cả {groups.length} nhóm!</p>
            <p className="text-[11px] text-slate-400 mt-1">Đã đăng: {doneCount} • Bỏ qua: {skippedCount}</p>
          </div>
        ) : (
          <div className="text-center py-4 text-slate-300 text-xs">Thêm nhóm ở phần ② để bắt đầu</div>
        )}

        {/* ═══ AUTO POST LOG ═══ */}
        {(autoPosting || autoPostLog.length > 0) && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-xs font-bold text-violet-600">Log tự động đăng bài</span>
                {autoPosting && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 font-bold animate-pulse">Đang chạy...</span>}
              </div>
              {autoPostLog.length > 0 && !autoPosting && (
                <button onClick={() => setAutoPostLog([])} className="text-[10px] text-slate-400 hover:text-red-500 font-semibold">Xóa log</button>
              )}
            </div>
            <div className="max-h-56 overflow-y-auto rounded-xl bg-slate-900 p-3 space-y-1 font-mono text-[11px] scroll-smooth">
              {autoPostLog.map((log, i) => (
                <div key={i} className={cn("flex items-start gap-2", {
                  "text-emerald-400": log.type === "group_done",
                  "text-red-400": log.type === "group_error" || log.type === "error",
                  "text-amber-400": log.type === "delay" || log.type === "waiting_login",
                  "text-blue-400": log.type === "posting" || log.type === "step",
                  "text-violet-400": log.type === "status" || log.type === "login_required",
                  "text-slate-500": log.type === "cancelled",
                  "text-cyan-400": log.type === "complete",
                })}>
                  <span className="text-slate-600 shrink-0">{log.timestamp}</span>
                  <span>{log.message}</span>
                </div>
              ))}
              {autoPosting && (
                <div className="flex items-center gap-1.5 text-violet-400 animate-pulse mt-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Đang xử lý...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab 2: Cào thông tin ─────────────────────────────────────────────────────
function ScrapeTab() {
  const [rawText, setRawText] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");

  // Auto scrape state
  type ScrapeMode = "auto" | "manual";
  const [mode, setMode] = useState<ScrapeMode>("auto");
  const [scrapeGroups, setScrapeGroups] = useState<Array<{ id: string; name: string; url: string }>>([]);
  const [newScrapeUrl, setNewScrapeUrl] = useState("");
  const [maxPosts, setMaxPosts] = useState(20);
  const [keywordsInput, setKeywordsInput] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeLog, setScrapeLog] = useState<Array<{ type: string; message: string; timestamp: string }>>([]);
  const [scrapeAbort, setScrapeAbort] = useState<AbortController | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("Tất cả");

  // Load/save leads from localStorage
  useEffect(() => { setLeads(loadLS<Lead[]>(LS_LEADS, [])); }, []);
  useEffect(() => { saveLS(LS_LEADS, leads); }, [leads]);

  // Manual paste analysis
  const analyzeText = async () => {
    if (!rawText.trim()) return;
    setIsAnalyzing(true);
    setError("");
    try {
      const res = await fetch("/api/facebook/extract-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      const data = await res.json();
      if (data.leads) {
        setLeads(prev => [...prev, ...data.leads.map((l: Omit<Lead, "id">) => ({ ...l, id: Date.now().toString() + Math.random() }))]);
        setRawText("");
      } else {
        setError(data.error || "Không trích xuất được leads");
      }
    } catch {
      setError("Lỗi kết nối. Kiểm tra lại.");
    }
    setIsAnalyzing(false);
  };

  // Auto scrape helpers
  const extractGroupName = (url: string, idx: number): string => {
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      const parts = u.pathname.split("/").filter(Boolean);
      const gi = parts.indexOf("groups");
      if (gi !== -1 && parts[gi + 1]) {
        const raw = parts[gi + 1].replace(/-/g, " ").replace(/\d{10,}/g, "").trim();
        if (raw) return raw;
      }
    } catch { /* */ }
    return `Nhóm ${idx + 1}`;
  };

  const addScrapeGroup = () => {
    if (!newScrapeUrl.trim()) return;
    const url = newScrapeUrl.trim();
    const name = extractGroupName(url, scrapeGroups.length);
    setScrapeGroups(prev => [...prev, { id: `sg-${Date.now()}`, name, url }]);
    setNewScrapeUrl("");
  };

  const removeScrapeGroup = (id: string) => setScrapeGroups(prev => prev.filter(g => g.id !== id));

  // Start auto scrape
  const startAutoScrape = async () => {
    if (scrapeGroups.length === 0) return;
    const controller = new AbortController();
    setScrapeAbort(controller);
    setIsScraping(true);
    setScrapeLog([]);

    const keywords = keywordsInput.split(",").map(k => k.trim()).filter(k => k.length > 0);

    try {
      const res = await fetch("/api/facebook/auto-scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groups: scrapeGroups.map(g => ({ name: g.name, url: g.url })),
          maxPosts,
          keywords,
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
              setScrapeLog(prev => [...prev, { ...data, timestamp }]);

              // Handle leads_found events — add leads incrementally
              if (data.type === "leads_found" && data.newLeads) {
                const newLeads = data.newLeads.map((l: Omit<Lead, "id">) => ({
                  ...l,
                  id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                }));
                setLeads(prev => [...prev, ...newLeads]);
              }

              if (data.type === "complete" || data.type === "error") {
                setIsScraping(false);
              }
            } catch { /* ignore */ }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        const timestamp = new Date().toLocaleTimeString("vi-VN");
        setScrapeLog(prev => [...prev, { type: "error", message: `❌ Lỗi: ${err.message}`, timestamp }]);
      }
    }
    setIsScraping(false);
    setScrapeAbort(null);
  };

  const stopAutoScrape = () => {
    if (scrapeAbort) { scrapeAbort.abort(); setScrapeAbort(null); }
    setIsScraping(false);
    const timestamp = new Date().toLocaleTimeString("vi-VN");
    setScrapeLog(prev => [...prev, { type: "cancelled", message: "⛔ Đã dừng cào thông tin.", timestamp }]);
  };

  // Lead helpers
  const removeLead = (id: string) => setLeads(prev => prev.filter(l => l.id !== id));
  const clearAllLeads = () => setLeads([]);
  const toggleContacted = (id: string) => setLeads(prev => prev.map(l => l.id === id ? { ...l, contacted: !l.contacted } : l));

  const exportCSV = () => {
    const rows = [
      ["Tên", "Nhu cầu", "Liên hệ", "Phân loại", "Độ tin cậy", "Đã liên hệ"].join(","),
      ...filteredLeads.map(l => [l.name, l.need, l.contact, l.category, l.confidence, l.contacted ? "Có" : "Chưa"].map(v => `"${v}"`).join(","))
    ].join("\n");
    const blob = new Blob(["\uFEFF" + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `leads_${Date.now()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const confidenceColor = (c: string) => ({
    high: "bg-emerald-50 text-emerald-700 border-emerald-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    low: "bg-slate-50 text-slate-500 border-slate-200",
  }[c] || "bg-slate-50 text-slate-500 border-slate-200");

  // Filter & search leads
  const allCategories = ["Tất cả", ...Array.from(new Set(leads.map(l => l.category).filter(Boolean)))];
  const filteredLeads = leads.filter(l => {
    const matchCategory = filterCategory === "Tất cả" || l.category === filterCategory;
    const matchSearch = !searchQuery || [l.name, l.need, l.contact, l.category].some(f => f?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCategory && matchSearch;
  });

  return (
    <div className="space-y-5">
      {/* ═══ ROW 1: NGUỒN DỮ LIỆU ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        {/* Mode switcher */}
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setMode("auto")}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border",
              mode === "auto" ? "bg-gradient-to-r from-cyan-50 to-blue-50 text-cyan-700 border-cyan-300 shadow-sm" : "bg-slate-50 text-slate-500 border-slate-200 hover:border-cyan-300")}>
            <Sparkles className="w-3.5 h-3.5" /> 🤖 Auto Scrape
          </button>
          <button onClick={() => setMode("manual")}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border",
              mode === "manual" ? "bg-gradient-to-r from-cyan-50 to-blue-50 text-cyan-700 border-cyan-300 shadow-sm" : "bg-slate-50 text-slate-500 border-slate-200 hover:border-cyan-300")}>
            <FileText className="w-3.5 h-3.5" /> 📋 Paste thủ công
          </button>
        </div>

        <AnimatePresence mode="wait">
          {mode === "auto" ? (
            <motion.div key="auto" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.12 }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <Globe className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-700">① Nhóm Facebook cần cào</h3>
                  <p className="text-[11px] text-slate-400">Puppeteer tự vào nhóm → scroll → cào bài + bình luận → AI phân tích</p>
                </div>
              </div>

              {/* Group list */}
              {scrapeGroups.length > 0 && (
                <div className="space-y-1.5 mb-3 max-h-32 overflow-y-auto">
                  {scrapeGroups.map((g, idx) => (
                    <div key={g.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-300 font-mono w-4 text-right">{idx + 1}</span>
                      <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-slate-700 truncate block">{g.name}</span>
                        <span className="text-[10px] text-slate-400 truncate block">{g.url}</span>
                      </div>
                      <button onClick={() => removeScrapeGroup(g.id)} className="text-slate-300 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add group input */}
              <div className="flex gap-2 mb-4">
                <input value={newScrapeUrl} onChange={e => setNewScrapeUrl(e.target.value)}
                  placeholder="Dán link nhóm Facebook (VD: https://facebook.com/groups/...)"
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
                  onKeyDown={e => e.key === "Enter" && addScrapeGroup()} />
                <button onClick={addScrapeGroup} className="p-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Settings row */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                    <FileText className="w-3 h-3" /> Số bài/nhóm
                  </label>
                  <select value={maxPosts} onChange={e => setMaxPosts(Number(e.target.value))}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none">
                    <option value={10}>10 bài</option>
                    <option value={20}>20 bài</option>
                    <option value={30}>30 bài</option>
                    <option value={50}>50 bài</option>
                  </select>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                    <Filter className="w-3 h-3" /> Keywords lọc
                  </label>
                  <input value={keywordsInput} onChange={e => setKeywordsInput(e.target.value)}
                    placeholder="cần, tìm, mua, tư vấn..."
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/30" />
                  <p className="text-[9px] text-slate-400 mt-1">Phân cách bằng dấu phẩy. Để trống = cào tất cả</p>
                </div>
              </div>

              {/* Start/Stop buttons */}
              <div className="flex gap-2">
                {!isScraping ? (
                  <button onClick={startAutoScrape} disabled={scrapeGroups.length === 0}
                    className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all",
                      scrapeGroups.length > 0 ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md hover:shadow-lg" : "bg-slate-100 text-slate-300 cursor-not-allowed")}>
                    <Sparkles className="w-4 h-4" /> 🚀 Bắt đầu cào {scrapeGroups.length} nhóm
                  </button>
                ) : (
                  <button onClick={stopAutoScrape}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-md hover:shadow-lg transition-all animate-pulse">
                    <X className="w-4 h-4" /> ⛔ Dừng cào
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div key="manual" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.12 }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <Search className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-700">Paste nội dung từ nhóm Facebook</h3>
                  <p className="text-[11px] text-slate-400">Sao chép bình luận / bài đăng → paste vào đây → AI tự tìm khách hàng tiềm năng</p>
                </div>
              </div>
              <textarea
                rows={6}
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder={`Ví dụ:\n"Mình đang cần tìm người thiết kế website, ai có thể liên hệ 0987654321"\n\n→ Paste nhiều comment cùng lúc, AI sẽ phân tích từng người.`}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/30 resize-none"
              />
              {error && (
                <div className="mt-2 flex items-center gap-2 text-red-500 text-xs">
                  <AlertCircle className="w-3.5 h-3.5" /> {error}
                </div>
              )}
              <div className="flex items-center justify-between mt-3">
                <span className="text-[11px] text-slate-400">{rawText.length} ký tự</span>
                <button
                  onClick={analyzeText}
                  disabled={!rawText.trim() || isAnalyzing}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all",
                    rawText.trim() && !isAnalyzing
                      ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md hover:shadow-lg"
                      : "bg-slate-100 text-slate-300 cursor-not-allowed"
                  )}
                >
                  {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {isAnalyzing ? "Đang phân tích..." : "Trích xuất khách hàng"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ SCRAPE LOG ═══ */}
      {(isScraping || scrapeLog.length > 0) && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-bold text-slate-700">② Log cào thông tin</span>
              {isScraping && <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-600 font-bold animate-pulse">Đang chạy...</span>}
            </div>
            {scrapeLog.length > 0 && !isScraping && (
              <button onClick={() => setScrapeLog([])} className="text-[10px] text-slate-400 hover:text-red-500 font-semibold">Xóa log</button>
            )}
          </div>
          <div className="max-h-56 overflow-y-auto rounded-xl bg-slate-900 p-3 space-y-1 font-mono text-[11px]">
            {scrapeLog.map((log, i) => (
              <div key={i} className={cn("flex items-start gap-2", {
                "text-emerald-400": log.type === "group_done" || log.type === "leads_found",
                "text-red-400": log.type === "group_error" || log.type === "error",
                "text-amber-400": log.type === "delay" || log.type === "waiting_login",
                "text-blue-400": log.type === "scraping" || log.type === "step",
                "text-violet-400": log.type === "status" || log.type === "login_required",
                "text-slate-500": log.type === "cancelled",
                "text-cyan-400": log.type === "complete",
              })}>
                <span className="text-slate-600 shrink-0">{log.timestamp}</span>
                <span>{log.message}</span>
              </div>
            ))}
            {isScraping && (
              <div className="flex items-center gap-1.5 text-cyan-400 animate-pulse mt-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Đang xử lý...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ LEADS TABLE ═══ */}
      {leads.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-500" />
                  <span className="text-sm font-bold text-slate-700">{leads.length} leads</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold">{leads.filter(l => l.contacted).length} đã liên hệ</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-bold">{leads.filter(l => !l.contacted).length} chưa liên hệ</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={clearAllLeads} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all">
                  <Trash2 className="w-3 h-3" /> Xóa hết
                </button>
                <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition-all">
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
              </div>
            </div>
            {/* Search & Filter */}
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên, nhu cầu, liên hệ..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400/30" />
              </div>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none">
                {allCategories.map(c => <option key={c}>{c}</option>)}
              </select>
              <span className="text-[10px] text-slate-400 shrink-0">{filteredLeads.length} hiển thị</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-4 py-2.5 font-bold">Tên</th>
                  <th className="text-left px-4 py-2.5 font-bold">Nhu cầu</th>
                  <th className="text-left px-4 py-2.5 font-bold">Liên hệ</th>
                  <th className="text-left px-4 py-2.5 font-bold">Phân loại</th>
                  <th className="text-center px-4 py-2.5 font-bold">Tin cậy</th>
                  <th className="text-center px-4 py-2.5 font-bold">Trạng thái</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredLeads.map(lead => (
                  <tr key={lead.id} className={cn("hover:bg-slate-50/60 transition-colors group", lead.contacted && "bg-emerald-50/30")}>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-800 text-xs">{lead.name || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-600 line-clamp-2">{lead.need}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-blue-600">{lead.contact || "—"}</span>
                        {lead.contact && lead.contact.includes("fb.com") && (
                          <a href={lead.contact.startsWith("http") ? lead.contact : `https://${lead.contact}`} target="_blank" rel="noopener noreferrer"
                            className="p-0.5 rounded hover:bg-blue-100 text-blue-400 hover:text-blue-600 transition-all" title="Mở Facebook">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">{lead.category}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border", confidenceColor(lead.confidence))}>
                        {lead.confidence === "high" ? "🟢 Cao" : lead.confidence === "medium" ? "🟡 TB" : "⚪ Thấp"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleContacted(lead.id)}
                        className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all border",
                          lead.contacted ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-200 hover:border-blue-300 hover:text-blue-500")}>
                        {lead.contacted ? <><CheckCircle2 className="w-3 h-3" /> Đã LH</> : <><MessageCircle className="w-3 h-3" /> Chưa LH</>}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => removeLead(lead.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}



// ─── Tab 3: Phân loại khách hàng ──────────────────────────────────────────────
function ClassifyTab() {
  const [pasteText, setPasteText] = useState("");
  const [keywords, setKeywords] = useState([
    { id: "1", label: "Cần web", kw: "website, thiết kế web, làm web, web bán hàng" },
    { id: "2", label: "Tư vấn marketing", kw: "marketing, quảng cáo, chạy ads, facebook ads" },
    { id: "3", label: "Bán hàng online", kw: "bán hàng, shop online, kinh doanh online" },
  ]);
  const [newLabel, setNewLabel] = useState("");
  const [newKw, setNewKw] = useState("");
  const [results, setResults] = useState<Array<{ text: string; matchedLabel: string; score: number }>>([]);
  const [isClassifying, setIsClassifying] = useState(false);
  const [filterLabel, setFilterLabel] = useState("Tất cả");

  const addKeyword = () => {
    if (!newLabel.trim() || !newKw.trim()) return;
    setKeywords(prev => [...prev, { id: Date.now().toString(), label: newLabel.trim(), kw: newKw.trim() }]);
    setNewLabel(""); setNewKw("");
  };

  const classify = async () => {
    if (!pasteText.trim()) return;
    setIsClassifying(true);
    try {
      const res = await fetch("/api/facebook/classify-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText, categories: keywords.map(k => ({ label: k.label, keywords: k.kw })) }),
      });
      const data = await res.json();
      if (data.results) setResults(data.results);
    } catch {
      // fallback: simple keyword matching
      const lines = pasteText.split("\n").filter(l => l.trim());
      const classified = lines.map(line => {
        let bestMatch = { label: "Không xác định", score: 0 };
        keywords.forEach(k => {
          const kwList = k.kw.split(",").map(kw => kw.trim().toLowerCase());
          const matches = kwList.filter(kw => line.toLowerCase().includes(kw)).length;
          if (matches > bestMatch.score) bestMatch = { label: k.label, score: matches };
        });
        return { text: line, matchedLabel: bestMatch.label, score: bestMatch.score };
      });
      setResults(classified);
    }
    setIsClassifying(false);
  };

  const allLabels = ["Tất cả", ...keywords.map(k => k.label), "Không xác định"];
  const filtered = filterLabel === "Tất cả" ? results : results.filter(r => r.matchedLabel === filterLabel);

  const exportCSV = () => {
    const rows = [["Nội dung", "Phân loại", "Độ khớp"].join(","),
    ...filtered.map(r => [`"${r.text}"`, `"${r.matchedLabel}"`, r.score].join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `classified_${Date.now()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT: Cài đặt phân loại */}
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
              <Tags className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Danh mục phân loại</h3>
          </div>
          <div className="space-y-2 mb-3">
            {keywords.map(k => (
              <div key={k.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-700">{k.label}</span>
                  <button onClick={() => setKeywords(prev => prev.filter(kw => kw.id !== k.id))} className="text-slate-300 hover:text-red-400 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">{k.kw}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Tên danh mục"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400/30" />
            <input value={newKw} onChange={e => setNewKw(e.target.value)} placeholder="Từ khóa (phân cách bằng dấu phẩy)"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400/30"
              onKeyDown={e => e.key === "Enter" && addKeyword()} />
            <button onClick={addKeyword} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Thêm danh mục
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: Phân tích */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
              <Filter className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Paste nội dung cần phân loại</h3>
          </div>
          <textarea
            rows={5}
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder={"Paste bình luận / bài đăng từ nhóm Facebook (mỗi dòng 1 nội dung)...\n\nVí dụ:\n\"Mình cần tư vấn thiết kế web bán quần áo\"\n\"Ai chạy ads facebook hiệu quả không ạ\"\n\"Shop mình muốn bán hàng online cần người hỗ trợ\""}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-400/30 resize-none"
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={classify}
              disabled={!pasteText.trim() || isClassifying}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all",
                pasteText.trim() && !isClassifying
                  ? "bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md hover:shadow-lg"
                  : "bg-slate-100 text-slate-300 cursor-not-allowed"
              )}
            >
              {isClassifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
              Phân loại ngay
            </button>
          </div>
        </div>

        {results.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-700">{filtered.length} kết quả</span>
              <div className="flex items-center gap-2">
                <select value={filterLabel} onChange={e => setFilterLabel(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none">
                  {allLabels.map(l => <option key={l}>{l}</option>)}
                </select>
                <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition-all">
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
            </div>
            <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
              {filtered.map((r, i) => (
                <div key={i} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50/60 transition-colors">
                  <span className={cn("mt-0.5 shrink-0 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border",
                    r.matchedLabel === "Không xác định" ? "bg-slate-50 text-slate-400 border-slate-200" : "bg-blue-50 text-blue-600 border-blue-100"
                  )}>
                    {r.matchedLabel}
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed">{r.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Main Component ───────────────────────────────────────────────────────────
const TABS = [
  { id: "post" as TabId, label: "Đăng bài nhóm", icon: Send, color: "from-blue-500 to-indigo-600", desc: "Soạn & đăng hàng loạt lên nhiều nhóm" },
  { id: "scrape" as TabId, label: "Cào thông tin", icon: Search, color: "from-cyan-500 to-blue-600", desc: "Paste text nhóm → AI tìm leads" },
  { id: "classify" as TabId, label: "Phân loại KH", icon: Tags, color: "from-orange-500 to-amber-600", desc: "Lọc khách theo nhu cầu cụ thể" },
];

export default function FacebookToolPage() {
  const [activeTab, setActiveTab] = useState<TabId>("post");

  return (
    <div className="w-full">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-2">
          <Globe className="h-3.5 w-3.5" />
          <span>TALPHA</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-600">Tool Page</span>
        </div>
        <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Facebook Tool Page</h2>
        <p className="text-sm text-slate-400 mt-1">Đăng bài hàng loạt • Cào thông tin khách hàng • Phân loại nhu cầu</p>
      </div>

      {/* Tab Switcher */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative p-4 rounded-2xl border text-left transition-all duration-200",
                isActive
                  ? "border-transparent shadow-lg scale-[1.01]"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
              )}
            >
              {isActive && (
                <div className={cn("absolute inset-0 rounded-2xl bg-gradient-to-br opacity-[0.08]", tab.color)} />
              )}
              <div className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center mb-2.5 bg-gradient-to-br",
                isActive ? tab.color : "from-slate-200 to-slate-300"
              )}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <div className={cn("text-sm font-bold", isActive ? "text-slate-800" : "text-slate-600")}>{tab.label}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{tab.desc}</div>
              {isActive && <div className={cn("absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 rounded-full bg-gradient-to-r", tab.color)} />}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === "post" && <PostTab />}
          {activeTab === "scrape" && <ScrapeTab />}
          {activeTab === "classify" && <ClassifyTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
