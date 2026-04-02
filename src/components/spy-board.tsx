"use client";

import { useEffect, useState } from "react";
import {
    Search, Eye, Flame, XCircle,
    TrendingUp, ExternalLink, RotateCw, Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SpyProduct {
    keyword: string;
    total_score: number;
    tier: string;
    tier_emoji: string;
    breakdown: {
        google_trends: number;
        fb_ads: number;
        shopee_rank: number;
        tiktok_engage: number;
        [key: string]: number;
    };
    details: {
        trend_score: number;
        trend_rising: boolean;
        fb_ad_count: number;
        shopee_sold: number;
        tiktok_views: number;
        tiktok_engagement: number;
        category: string;
        [key: string]: any;
    };
    fb_spy_link: string;
}

interface SpyData {
    date: string;
    total: number;
    summary: { hot: number; watch: number; skip: number };
    products: SpyProduct[];
    available_dates: string[];
}

function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
    return String(n);
}

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
    const pct = Math.min(100, (score / max) * 100);
    const color = pct >= 60 ? "bg-blue-500" : pct >= 30 ? "bg-red-400" : "bg-slate-300";
    return (
        <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-bold text-slate-700">{score}</span>
        </div>
    );
}

function TierBadge({ tier, emoji }: { tier: string; emoji: string }) {
    const styles: Record<string, string> = {
        HOT: "bg-red-50 text-red-600 border-red-200",
        WATCH: "bg-blue-50 text-blue-600 border-blue-200",
        SKIP: "bg-slate-50 text-slate-400 border-slate-200",
    };
    return (
        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border", styles[tier] || styles.SKIP)}>
            {emoji} {tier}
        </span>
    );
}

export default function SpyBoardTab() {
    const [data, setData] = useState<SpyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [filterTier, setFilterTier] = useState<string>("ALL");

    const fetchData = async (date?: string) => {
        setLoading(true);
        try {
            const params = date ? `?date=${date}` : "";
            const res = await fetch(`/api/talpha/spy${params}`);
            const json = await res.json();
            setData(json);
            if (!selectedDate && json.date) setSelectedDate(json.date);
        } catch (err) {
            console.error("Spy fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleDateChange = (date: string) => {
        setSelectedDate(date);
        fetchData(date);
    };

    const filteredProducts = data?.products
        ?.filter(p => filterTier === "ALL" || p.tier === filterTier)
        .sort((a, b) => b.total_score - a.total_score) || [];

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center h-64">
                <RotateCw className="h-6 w-6 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPIStatCard
                    label="Tổng Sản Phẩm"
                    value={data?.total || 0}
                    icon={<Search className="h-4 w-4" />}
                    color="blue"
                />
                <KPIStatCard
                    label="HOT — Test ngay"
                    value={data?.summary?.hot || 0}
                    icon={<Flame className="h-4 w-4" />}
                    color="rose"
                />
                <KPIStatCard
                    label="WATCH — Theo dõi"
                    value={data?.summary?.watch || 0}
                    icon={<Eye className="h-4 w-4" />}
                    color="amber"
                />
                <KPIStatCard
                    label="SKIP"
                    value={data?.summary?.skip || 0}
                    icon={<XCircle className="h-4 w-4" />}
                    color="slate"
                />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {["ALL", "HOT", "WATCH", "SKIP"].map(tier => (
                        <button
                            key={tier}
                            onClick={() => setFilterTier(tier)}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                filterTier === tier
                                    ? "bg-blue-600 text-white shadow-sm"
                                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            )}
                        >
                            {tier === "ALL" ? "Tất cả" : tier}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-3">
                    {data?.available_dates && data.available_dates.length > 0 && (
                        <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            <select
                                value={selectedDate}
                                onChange={(e) => handleDateChange(e.target.value)}
                                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:border-blue-400"
                            >
                                {data.available_dates.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <button
                        onClick={() => fetchData(selectedDate)}
                        disabled={loading}
                        className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg px-3 py-1.5 text-xs font-medium transition"
                    >
                        <RotateCw className={cn("h-3 w-3", loading && "animate-spin")} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Search className="h-4 w-4 text-blue-500" />
                        Bảng Sản Phẩm Spy
                    </h3>
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                        {filteredProducts.length} sản phẩm
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                <th className="text-left px-5 py-3 font-bold">Sản Phẩm</th>
                                <th className="text-left px-3 py-3 font-bold">Score</th>
                                <th className="text-left px-3 py-3 font-bold">Tier</th>
                                <th className="text-right px-3 py-3 font-bold">Trends</th>
                                <th className="text-right px-3 py-3 font-bold">FB Ads</th>
                                <th className="text-right px-3 py-3 font-bold">Shopee</th>
                                <th className="text-right px-3 py-3 font-bold">TikTok</th>
                                <th className="text-center px-3 py-3 font-bold">Link</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredProducts.length > 0 ? filteredProducts.map((p, i) => (
                                <tr key={p.keyword} className="group hover:bg-slate-50/80 transition-colors">
                                    <td className="px-5 py-3.5">
                                        <div className="font-semibold text-slate-800">{p.keyword}</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">{p.details?.category || "—"}</div>
                                    </td>
                                    <td className="px-3 py-3.5">
                                        <ScoreBar score={p.total_score} />
                                    </td>
                                    <td className="px-3 py-3.5">
                                        <TierBadge tier={p.tier} emoji={p.tier_emoji} />
                                    </td>
                                    <td className="px-3 py-3.5 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {p.details?.trend_rising && <TrendingUp className="h-3 w-3 text-blue-500" />}
                                            <span className="text-xs font-mono text-slate-600">{p.breakdown?.google_trends || 0}đ</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3.5 text-right">
                                        <div className="text-xs font-mono text-slate-600">{p.details?.fb_ad_count || 0} ads</div>
                                        <div className="text-[10px] text-blue-500 font-semibold">{p.breakdown?.fb_ads || 0}đ</div>
                                    </td>
                                    <td className="px-3 py-3.5 text-right">
                                        <div className="text-xs font-mono text-slate-600">{formatNumber(p.details?.shopee_sold || 0)} sold</div>
                                        <div className="text-[10px] text-blue-500 font-semibold">{p.breakdown?.shopee_rank || 0}đ</div>
                                    </td>
                                    <td className="px-3 py-3.5 text-right">
                                        <div className="text-xs font-mono text-slate-600">{formatNumber(p.details?.tiktok_views || 0)} views</div>
                                        <div className="text-[10px] text-slate-400">{p.details?.tiktok_engagement || 0}%</div>
                                    </td>
                                    <td className="px-3 py-3.5 text-center">
                                        {p.fb_spy_link ? (
                                            <a
                                                href={p.fb_spy_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-md text-[10px] font-semibold hover:bg-blue-100 transition"
                                            >
                                                FB Ads <ExternalLink className="h-2.5 w-2.5" />
                                            </a>
                                        ) : "—"}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={8} className="py-16 text-center text-slate-400 italic">
                                        Không có dữ liệu spy cho ngày này
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function KPIStatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
    const colorMap: Record<string, { bg: string; text: string; border: string }> = {
        blue: { bg: "bg-blue-50", text: "text-blue-500", border: "border-l-blue-500" },
        rose: { bg: "bg-red-50", text: "text-red-500", border: "border-l-red-500" },
        amber: { bg: "bg-blue-50", text: "text-blue-400", border: "border-l-blue-400" },
        slate: { bg: "bg-slate-50", text: "text-slate-400", border: "border-l-slate-300" },
    };
    const c = colorMap[color] || colorMap.slate;
    return (
        <div className={cn("bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm border-l-[3px]", c.border)}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</span>
                <div className={cn("p-1.5 rounded-lg", c.bg, c.text)}>{icon}</div>
            </div>
            <div className="text-3xl font-black text-slate-900">{value}</div>
        </div>
    );
}
