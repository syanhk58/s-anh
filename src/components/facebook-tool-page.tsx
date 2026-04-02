"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Search, Tags, Plus, Trash2, Copy, Check,
  ExternalLink, Loader2, ChevronRight, Wand2, Download,
  Users, Globe, Filter, AlertCircle, CheckCircle2,
  Clock, Play, SkipForward, RotateCw, Sparkles,
  FileText, X
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface FbGroup {
  id: string;
  name: string;
  url: string;
  status: "pending" | "done" | "skipped";
}

interface Lead {
  id: string;
  rawText: string;
  name: string;
  need: string;
  contact: string;
  category: string;
  confidence: "high" | "medium" | "low";
}

type TabId = "post" | "scrape" | "classify";

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

// ─── Tab 1: Đăng bài nhóm ────────────────────────────────────────────────────
function PostTab() {
  const [content, setContent] = useState("");
  const [groups, setGroups] = useState<FbGroup[]>([
    { id: "1", name: "Nhóm kinh doanh online", url: "https://facebook.com/groups/", status: "pending" },
  ]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupUrl, setNewGroupUrl] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [variations, setVariations] = useState<string[]>([]);
  const [selectedVariation, setSelectedVariation] = useState(0);
  const [sessionActive, setSessionActive] = useState(false);

  const addGroup = () => {
    if (!newGroupName.trim() || !newGroupUrl.trim()) return;
    setGroups(prev => [...prev, {
      id: Date.now().toString(),
      name: newGroupName.trim(),
      url: newGroupUrl.trim(),
      status: "pending"
    }]);
    setNewGroupName("");
    setNewGroupUrl("");
  };

  const removeGroup = (id: string) => setGroups(prev => prev.filter(g => g.id !== id));

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
      if (data.variations) {
        setVariations(data.variations);
        setSelectedVariation(0);
      }
    } catch {
      setVariations([content]);
    }
    setIsGenerating(false);
  };

  const pendingGroups = groups.filter(g => g.status === "pending");
  const doneCount = groups.filter(g => g.status === "done").length;
  const currentGroup = pendingGroups[0];

  const openNextGroup = () => {
    if (!currentGroup) return;
    const postContent = variations.length > 0 ? variations[selectedVariation % variations.length] : content;
    navigator.clipboard.writeText(postContent);
    window.open(currentGroup.url, "_blank");
    setSessionActive(true);
  };

  const markDone = () => {
    if (!currentGroup) return;
    setGroups(prev => prev.map(g => g.id === currentGroup.id ? { ...g, status: "done" } : g));
    setSelectedVariation(prev => prev + 1);
  };

  const markSkipped = () => {
    if (!currentGroup) return;
    setGroups(prev => prev.map(g => g.id === currentGroup.id ? { ...g, status: "skipped" } : g));
  };

  const resetSession = () => {
    setGroups(prev => prev.map(g => ({ ...g, status: "pending" })));
    setSessionActive(false);
    setSelectedVariation(0);
  };

  const postContent = variations.length > 0 ? variations[selectedVariation % variations.length] : content;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT: Soạn nội dung */}
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Nội dung bài đăng</h3>
          </div>
          <textarea
            rows={6}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Soạn nội dung bài viết muốn đăng lên các nhóm..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-300 resize-none transition-all"
          />
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={generateVariations}
              disabled={!content.trim() || isGenerating}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                content.trim() && !isGenerating
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-200/50 hover:shadow-violet-300/60"
                  : "bg-slate-100 text-slate-300 cursor-not-allowed"
              )}
            >
              {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              AI tạo {variations.length > 0 ? "lại" : ""} 3 biến thể
            </button>
            {content && <CopyButton text={postContent} />}
          </div>
        </div>

        {/* Variations */}
        {variations.length > 0 && (
          <div className="bg-white rounded-2xl border border-violet-200/60 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-violet-600">✨ {variations.length} biến thể AI tạo</span>
              <span className="text-[11px] text-slate-400">Mỗi nhóm dùng 1 biến thể khác nhau</span>
            </div>
            <div className="space-y-2">
              {variations.map((v, i) => (
                <div key={i} className={cn(
                  "rounded-xl border p-3 cursor-pointer transition-all",
                  selectedVariation % variations.length === i
                    ? "border-violet-300 bg-violet-50/50"
                    : "border-slate-200 hover:border-violet-200"
                )} onClick={() => setSelectedVariation(i)}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-violet-500">Biến thể {i + 1}</span>
                    <CopyButton text={v} />
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-3 whitespace-pre-line">{v}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: Danh sách nhóm */}
      <div className="space-y-4">
        {/* Progress */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Send className="w-3.5 h-3.5 text-white" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">Tiến độ đăng bài</h3>
            </div>
            <button onClick={resetSession} className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1">
              <RotateCw className="w-3 h-3" /> Reset
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "Tổng nhóm", value: groups.length, color: "text-slate-700" },
              { label: "Đã đăng", value: doneCount, color: "text-emerald-600" },
              { label: "Còn lại", value: pendingGroups.length, color: "text-blue-600" },
            ].map(s => (
              <div key={s.label} className="bg-slate-50 rounded-xl p-2.5 text-center">
                <div className={cn("text-xl font-black", s.color)}>{s.value}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
              style={{ width: `${groups.length > 0 ? (doneCount / groups.length) * 100 : 0}%` }}
            />
          </div>

          {/* Current action */}
          {currentGroup ? (
            <div className="space-y-3">
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                <div className="text-[11px] text-blue-400 font-semibold mb-1">NHÓM TIẾP THEO</div>
                <div className="font-semibold text-slate-700 text-sm">{currentGroup.name}</div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">{currentGroup.url}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={openNextGroup}
                  disabled={!content.trim()}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all",
                    content.trim()
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:shadow-lg"
                      : "bg-slate-100 text-slate-300 cursor-not-allowed"
                  )}
                >
                  <Play className="w-4 h-4" /> Mở nhóm & Copy nội dung
                </button>
              </div>
              {sessionActive && (
                <div className="flex gap-2">
                  <button onClick={markDone} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-all">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đã đăng xong
                  </button>
                  <button onClick={markSkipped} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100 transition-all">
                    <SkipForward className="w-3.5 h-3.5" /> Bỏ qua
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-emerald-600">Hoàn thành tất cả nhóm!</p>
            </div>
          )}
        </div>

        {/* Group list */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Danh sách nhóm ({groups.length})</h3>
          <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
            {groups.map(g => (
              <div key={g.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className={cn("w-2 h-2 rounded-full shrink-0", {
                  "bg-slate-300": g.status === "pending",
                  "bg-emerald-400": g.status === "done",
                  "bg-amber-400": g.status === "skipped",
                })} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-700 truncate">{g.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">{g.url}</div>
                </div>
                <button onClick={() => removeGroup(g.id)} className="text-slate-300 hover:text-red-400 transition-colors shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              placeholder="Tên nhóm"
              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/30"
            />
            <input
              value={newGroupUrl}
              onChange={e => setNewGroupUrl(e.target.value)}
              placeholder="Link nhóm"
              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/30"
              onKeyDown={e => e.key === "Enter" && addGroup()}
            />
            <button onClick={addGroup} className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
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

  const removeLead = (id: string) => setLeads(prev => prev.filter(l => l.id !== id));

  const exportCSV = () => {
    const rows = [
      ["Tên", "Nhu cầu", "Liên hệ", "Phân loại", "Độ tin cậy"].join(","),
      ...leads.map(l => [l.name, l.need, l.contact, l.category, l.confidence].map(v => `"${v}"`).join(","))
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

  return (
    <div className="space-y-5">
      {/* Input */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Search className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-700">Paste nội dung từ nhóm Facebook</h3>
            <p className="text-[11px] text-slate-400">Sao chép bình luận / bài đăng từ nhóm → paste vào đây → AI tự tìm khách hàng tiềm năng</p>
          </div>
        </div>
        <textarea
          rows={7}
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          placeholder={`Ví dụ:\n"Chào mọi người, mình đang cần tìm người thiết kế website cho shop thời trang, ai có thể liên hệ qua đây cho mình nhé 0987654321"\n\n"Cho hỏi group có ai chuyên làm marketing online không, cần tư vấn gấp. Inbox mình tại: fb.com/xyz"

→ Có thể paste nhiều comment cùng lúc, AI sẽ phân tích từng người.`}
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
      </div>

      {/* Leads table */}
      {leads.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-500" />
              <span className="text-sm font-bold text-slate-700">{leads.length} khách hàng tiềm năng</span>
            </div>
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition-all">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-4 py-2.5 font-bold">Tên / Profile</th>
                  <th className="text-left px-4 py-2.5 font-bold">Nhu cầu</th>
                  <th className="text-left px-4 py-2.5 font-bold">Liên hệ</th>
                  <th className="text-left px-4 py-2.5 font-bold">Phân loại</th>
                  <th className="text-center px-4 py-2.5 font-bold">Độ tin</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-800 text-xs">{lead.name || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-600 line-clamp-2">{lead.need}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-blue-600">{lead.contact || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                        {lead.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border", confidenceColor(lead.confidence))}>
                        {lead.confidence === "high" ? "Cao" : lead.confidence === "medium" ? "TB" : "Thấp"}
                      </span>
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
