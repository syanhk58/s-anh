"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Upload, ImageIcon, FileText, Sparkles, Copy, Check,
    FlaskConical, BookOpen, Wand2, X, Loader2, ChevronRight,
    Bot, Plus, Trash2, Images, AlertCircle, Send, Download
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getTemplateForCategory } from "@/config/sample-templates";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProductImage {
    id: string;
    dataUrl: string;
    name: string;
    mediaType: string;
}

interface GeneratedOutput {
    pitchVi: string;
    pitchEn: string;
    pitchPh: string;
    botcakeVi: string;
    botcakeEn: string;
    ingredientsVi: string;
    ingredientsEn: string;
    ingredientsPh: string;
    usageVi: string;
    usageEn: string;
    usagePh: string;
    error?: string;
}

const EMPTY_OUTPUT: GeneratedOutput = {
    pitchVi: "", pitchEn: "", pitchPh: "",
    botcakeVi: "", botcakeEn: "",
    ingredientsVi: "", ingredientsEn: "", ingredientsPh: "",
    usageVi: "", usageEn: "", usagePh: "",
};

// ─── Call API — gửi TẤT CẢ ảnh cùng lúc cho 1 sản phẩm ──────────────────────
async function analyzeProduct(
    images: ProductImage[],
    samplePitch: string,
    sampleBotcake: string,
    country: string,
    currency: string,
    priceCombo1: string,
    priceCombo2: string
): Promise<GeneratedOutput> {
    const imageList = images.map((img) => ({
        base64: img.dataUrl.split(",")[1],
        mimeType: img.mediaType || "image/jpeg",
    }));

    try {
        const res = await fetch("/api/ai/analyze-product", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                images: imageList,
                samplePitch,
                sampleBotcake,
                country,
                currency,
                priceCombo1,
                priceCombo2,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            return { ...EMPTY_OUTPUT, error: data.error || "Lỗi không xác định" };
        }

        return {
            pitchVi: data.pitchVi || "",
            pitchEn: data.pitchEn || "",
            pitchPh: data.pitchPh || "",
            botcakeVi: data.botcakeVi || "",
            botcakeEn: data.botcakeEn || "",
            ingredientsVi: data.ingredientsVi || "",
            ingredientsEn: data.ingredientsEn || "",
            ingredientsPh: data.ingredientsPh || "",
            usageVi: data.usageVi || "",
            usageEn: data.usageEn || "",
            usagePh: data.usagePh || "",
        };
    } catch (err) {
        return { ...EMPTY_OUTPUT, error: err instanceof Error ? err.message : "Network error" };
    }
}

// ─── Copy Button ──────────────────────────────────────────────────────────────
function CopyButton({ text, label = "Sao chép" }: { text: string; label?: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button
            onClick={handleCopy}
            className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all duration-300 shrink-0",
                copied
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    : "bg-slate-50 text-slate-500 border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
            )}
        >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Đã chép!" : label}
        </button>
    );
}

// ─── Sync Button (Push Pancake / Download Botcake) ────────────────────────────
type SyncStatus = 'idle' | 'loading' | 'success' | 'error';

function SyncButton({
    icon: Icon,
    label,
    onClick,
    isLoading,
    variant,
}: {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
    isLoading: boolean;
    variant: 'pancake' | 'botcake';
}) {
    const colors = variant === 'pancake'
        ? 'from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-orange-200/50'
        : 'from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 shadow-cyan-200/50';

    return (
        <button
            onClick={onClick}
            disabled={isLoading}
            className={cn(
                "w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-sm font-bold text-white transition-all duration-300 shadow-lg",
                "bg-gradient-to-r",
                colors,
                isLoading && "opacity-70 cursor-wait"
            )}
        >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
            {label}
        </button>
    );
}

// ─── Multi-Image Drop Zone ────────────────────────────────────────────────────
function MultiImageDropZone({
    images,
    onImagesAdd,
    onRemoveImage,
}: {
    images: ProductImage[];
    onImagesAdd: (newImages: ProductImage[]) => void;
    onRemoveImage: (id: string) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFiles = useCallback(
        (files: FileList) => {
            const imageFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
            let loaded = 0;
            const newImages: ProductImage[] = [];

            imageFiles.forEach((file) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (e.target?.result) {
                        newImages.push({
                            id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                            dataUrl: e.target.result as string,
                            name: file.name,
                            mediaType: file.type,
                        });
                        loaded++;
                        if (loaded === imageFiles.length) {
                            onImagesAdd(newImages);
                        }
                    }
                };
                reader.readAsDataURL(file);
            });
        },
        [onImagesAdd]
    );

    const onDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
        },
        [handleFiles]
    );

    return (
        <div className="space-y-3">
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
                    e.target.value = "";
                }}
            />

            <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                className={cn(
                    "cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center py-6 px-4",
                    isDragging
                        ? "border-blue-400 bg-blue-50/80 scale-[1.01]"
                        : "border-slate-200 bg-slate-50/50 hover:border-blue-300 hover:bg-blue-50/40"
                )}
            >
                <div className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center mb-2 transition-colors",
                    isDragging ? "bg-blue-100 text-blue-500" : "bg-slate-100 text-slate-400"
                )}>
                    <Upload className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold text-slate-600">Kéo & thả nhiều ảnh sản phẩm</p>
                <p className="text-xs text-slate-400 mt-0.5">Chọn nhiều file cùng lúc • PNG, JPG, WebP</p>
            </div>

            {images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {images.map((img) => (
                        <motion.div
                            key={img.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative group rounded-xl overflow-hidden border border-slate-200/80 bg-white shadow-sm w-20 h-20"
                        >
                            <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemoveImage(img.id); }}
                                className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                            >
                                <X className="h-2.5 w-2.5" />
                            </button>
                        </motion.div>
                    ))}
                    <button
                        onClick={() => inputRef.current?.click()}
                        className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center hover:border-blue-300 hover:bg-blue-50/40 transition-all"
                    >
                        <Plus className="h-4 w-4 text-slate-300" />
                    </button>
                </div>
            )}

            {images.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Images className="h-3 w-3" />
                    <span>{images.length} ảnh đã chọn</span>
                </div>
            )}
        </div>
    );
}

// ─── Output Card (standalone box with copy) ──────────────────────────────────
function OutputCard({
    icon: Icon,
    label,
    content,
    emptyText = "Chưa có dữ liệu",
    gradientClass,
    iconColorClass,
    isLoading = false,
}: {
    icon: React.ElementType;
    label: string;
    content: string;
    emptyText?: string;
    gradientClass: string;
    iconColorClass: string;
    isLoading?: boolean;
}) {
    const hasContent = content.trim().length > 0;

    return (
        <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", iconColorClass)} />
                    <span className="text-xs font-bold text-slate-600">{label}</span>
                </div>
                {hasContent && <CopyButton text={content} />}
            </div>
            <div className={cn("p-4 flex-1 min-h-[120px]", hasContent ? gradientClass : "")}>
                {isLoading && !hasContent ? (
                    <div className="flex items-center gap-2 text-slate-400 h-full justify-center">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs font-medium">Đang phân tích...</span>
                    </div>
                ) : hasContent ? (
                    <pre className="text-[13px] text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{content}</pre>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-xs text-slate-300 font-medium">{emptyText}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Section Header ──────────────────────────────────────────────────────────
function SectionHeader({
    icon: Icon,
    title,
    subtitle,
    colorClass,
}: {
    icon: React.ElementType;
    title: string;
    subtitle?: string;
    colorClass: string;
}) {
    return (
        <div className="flex items-center gap-2.5 mb-3">
            <div className={cn("h-7 w-7 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-md", colorClass)}>
                <Icon className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
                <h3 className="text-sm font-bold text-slate-700 leading-none">{title}</h3>
                {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ScriptGeneratorTab() {
    const [productImages, setProductImages] = useState<ProductImage[]>([]);
    const [samplePitch, setSamplePitch] = useState("");
    const [sampleBotcake, setSampleBotcake] = useState("");
    const [output, setOutput] = useState<GeneratedOutput | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [syncPancake, setSyncPancake] = useState<SyncStatus>('idle');
    const [syncBotcake, setSyncBotcake] = useState<SyncStatus>('idle');

    // Filter state
    const [filterCountry, setFilterCountry] = useState("");
    const [priceCombo1, setPriceCombo1] = useState("");
    const [priceCombo2, setPriceCombo2] = useState("");
    const [filterCategory, setFilterCategory] = useState("");

    // ─── Auto-suggest templates based on filters ─────────────────────────────
    const COUNTRY_LABELS: Record<string, string> = {
        SA: "Saudi Arabia", AE: "UAE", KW: "Kuwait", OM: "Oman",
        QA: "Qatar", BH: "Bahrain", JP: "Japan", TW: "Taiwan"
    };

    const COUNTRY_CURRENCIES: Record<string, string> = {
        SA: "SAR", AE: "AED", KW: "KWD", OM: "OMR",
        QA: "QAR", BH: "BHD", JP: "JPY", TW: "TWD"
    };

    const autoSuggestTemplates = (country: string, category: string, p1: string, p2: string) => {
        if (!country && !category) return;

        const countryName = COUNTRY_LABELS[country] || "thị trường quốc tế";
        const currency = COUNTRY_CURRENCIES[country] || "USD";
        const price1 = p1 ? `${p1} ${currency}` : `[GIÁ ${currency}]`;
        const price2 = p2 ? `${p2} ${currency}` : `[GIÁ ${currency}]`;
        const tmpl = getTemplateForCategory(category);

        // Replace [GIÁ_1] and [GIÁ_2] placeholders, then fallback [GIÁ...]
        const replacePrices = (text: string) => text
            .replace(/\[GIÁ_1[^\]]*\]/g, price1)
            .replace(/\[GIÁ_2[^\]]*\]/g, price2)
            .replace(/\[GIÁ\b[^\]]*\]/g, price1)  // fallback: old templates
            .replace(/thị trường quốc tế/g, countryName);

        setSamplePitch(replacePrices(tmpl.pitch));
        setSampleBotcake(replacePrices(tmpl.botcake));
    };

    // Shop list for Pancake push
    const [shops, setShops] = useState<Array<{ name: string; shop_id: string }>>([]);
    const [selectedShopId, setSelectedShopId] = useState<string>("");

    // Fetch shop list on mount
    useEffect(() => {
        fetch('/api/pancake/push-template')
            .then(res => res.json())
            .then(data => {
                if (data.shops) {
                    setShops(data.shops);
                    if (data.shops.length > 0) setSelectedShopId(data.shops[0].shop_id);
                }
            })
            .catch(() => {});
    }, []);

    const canGenerate = productImages.length > 0;

    const handleAddImages = (newImages: ProductImage[]) => {
        setProductImages((prev) => [...prev, ...newImages]);
    };

    const handleRemoveImage = (id: string) => {
        setProductImages((prev) => prev.filter((img) => img.id !== id));
    };

    const handleGenerate = async () => {
        if (!canGenerate) return;
        setIsGenerating(true);
        setOutput(null);

        const currency = COUNTRY_CURRENCIES[filterCountry] || "USD";
        const result = await analyzeProduct(
            productImages,
            samplePitch,
            sampleBotcake,
            filterCountry,
            currency,
            priceCombo1,
            priceCombo2
        );
        setOutput(result);
        setIsGenerating(false);
    };

    const handleReset = () => {
        setProductImages([]);
        setSamplePitch("");
        setSampleBotcake("");
        setOutput(null);
        setSyncPancake('idle');
        setSyncBotcake('idle');
        setFilterCountry('');
        setPriceCombo1('');
        setPriceCombo2('');
        setFilterCategory('');
    };

    // ─── Push to Pancake ──────────────────────────────────────────────────────
    const handlePushPancake = async () => {
        if (!output || !selectedShopId) {
            alert('⚠️ Chưa chọn shop Pancake!');
            return;
        }
        setSyncPancake('loading');
        try {
            const res = await fetch('/api/pancake/push-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shopId: selectedShopId,
                    pitchVi: output.pitchVi,
                    pitchEn: output.pitchEn,
                    pitchPh: output.pitchPh,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setSyncPancake('success');
                alert(`✅ ${data.message}`);
                setTimeout(() => setSyncPancake('idle'), 5000);
            } else {
                alert(`⚠️ ${data.message || data.error}`);
                setSyncPancake('error');
                setTimeout(() => setSyncPancake('idle'), 3000);
            }
        } catch {
            alert('❌ Lỗi kết nối. Kiểm tra lại mạng.');
            setSyncPancake('error');
            setTimeout(() => setSyncPancake('idle'), 3000);
        }
    };

    // ─── Download Botcake Training File ───────────────────────────────────────
    const handleDownloadBotcake = async () => {
        if (!output) return;
        setSyncBotcake('loading');
        try {
            const res = await fetch('/api/botcake/generate-training', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    botcakeVi: output.botcakeVi,
                    botcakeEn: output.botcakeEn,
                    ingredientsVi: output.ingredientsVi,
                    ingredientsEn: output.ingredientsEn,
                    usageVi: output.usageVi,
                    usageEn: output.usageEn,
                    pitchVi: output.pitchVi,
                    pitchEn: output.pitchEn,
                }),
            });
            if (!res.ok) throw new Error('Download failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `botcake_training_${Date.now()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setSyncBotcake('success');
            setTimeout(() => setSyncBotcake('idle'), 5000);
        } catch {
            alert('❌ Lỗi tạo file. Thử lại.');
            setSyncBotcake('error');
            setTimeout(() => setSyncBotcake('idle'), 3000);
        }
    };

    const textareaClass =
        "w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-300 transition-all resize-none shadow-sm";

    return (
        <div className="w-full animate-in">
            {/* Page Header */}
            <div className="mb-5">
                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-2">
                    <FileText className="h-3.5 w-3.5" />
                    <span>TALPHA</span>
                    <ChevronRight className="h-3 w-3" />
                    <span className="text-slate-600">Tạo kịch bản</span>
                </div>
                <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
                    Tạo kịch bản chào hàng
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                    Upload ảnh sản phẩm (nhiều góc) → AI phân tích → nhận kịch bản đa ngôn ngữ, thành phần, HDSD, Botcake.
                </p>
            </div>

            {/* ═══ ROW 1: ẢNH SẢN PHẨM (full width) ═══ */}
            <div className="rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm shadow-sm p-5 mb-4">
                <SectionHeader
                    icon={ImageIcon}
                    title="Ảnh sản phẩm"
                    subtitle="Upload nhiều ảnh cùng lúc — AI sẽ phân tích tất cả"
                    colorClass="from-blue-500 to-blue-600 shadow-blue-200/40"
                />
                <MultiImageDropZone
                    images={productImages}
                    onImagesAdd={handleAddImages}
                    onRemoveImage={handleRemoveImage}
                />
            </div>

            {/* ═══ ROW 2: BỘ LỌC + MẪU (3 cols) ═══ */}
            <div className="rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm shadow-sm p-5 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* 1. Bộ lọc — ĐẦU TIÊN */}
                    <div>
                        <SectionHeader
                            icon={Sparkles}
                            title="Bộ lọc sản phẩm"
                            subtitle="Chọn → tự đề xuất mẫu bên phải"
                            colorClass="from-violet-500 to-purple-500 shadow-violet-200/40"
                        />
                        <div className="flex flex-col gap-2.5">
                            <select
                                value={filterCountry}
                                onChange={(e) => {
                                    setFilterCountry(e.target.value);
                                    autoSuggestTemplates(e.target.value, filterCategory, priceCombo1, priceCombo2);
                                }}
                                className="w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400/30 shadow-sm"
                            >
                                <option value="">🌍 Tất cả quốc gia</option>
                                <option value="SA">🇸🇦 Saudi Arabia</option>
                                <option value="AE">🇦🇪 UAE</option>
                                <option value="KW">🇰🇼 Kuwait</option>
                                <option value="OM">🇴🇲 Oman</option>
                                <option value="QA">🇶🇦 Qatar</option>
                                <option value="BH">🇧🇭 Bahrain</option>
                                <option value="JP">🇯🇵 Japan</option>
                                <option value="TW">🇹🇼 Taiwan</option>
                            </select>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="text"
                                    value={priceCombo1}
                                    onChange={(e) => {
                                        setPriceCombo1(e.target.value);
                                        autoSuggestTemplates(filterCountry, filterCategory, e.target.value, priceCombo2);
                                    }}
                                    placeholder="💎 Combo 1"
                                    className="w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400/30 shadow-sm"
                                />
                                <input
                                    type="text"
                                    value={priceCombo2}
                                    onChange={(e) => {
                                        setPriceCombo2(e.target.value);
                                        autoSuggestTemplates(filterCountry, filterCategory, priceCombo1, e.target.value);
                                    }}
                                    placeholder="🔥 Combo 2"
                                    className="w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400/30 shadow-sm"
                                />
                            </div>
                            <select
                                value={filterCategory}
                                onChange={(e) => {
                                    setFilterCategory(e.target.value);
                                    autoSuggestTemplates(filterCountry, e.target.value, priceCombo1, priceCombo2);
                                }}
                                className="w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400/30 shadow-sm"
                            >
                                <option value="">📦 Tất cả danh mục</option>
                                <option value="jewelry">💎 Trang sức</option>
                                <option value="skincare">🧴 Mỹ phẩm / Skincare</option>
                                <option value="health">💊 Thực phẩm chức năng</option>
                                <option value="haircare">💇 Chăm sóc tóc</option>
                                <option value="other">📋 Khác</option>
                            </select>
                        </div>
                    </div>

                    {/* 2. Sample Pitch */}
                    <div>
                        <SectionHeader
                            icon={FileText}
                            title="Kịch bản chào hàng mẫu"
                            subtitle="Tự động đề xuất theo bộ lọc"
                            colorClass="from-amber-500 to-orange-500 shadow-amber-200/40"
                        />
                        <textarea
                            rows={5}
                            className={textareaClass}
                            placeholder="Chọn bộ lọc bên trái → mẫu tự xuất hiện..."
                            value={samplePitch}
                            onChange={(e) => setSamplePitch(e.target.value)}
                        />
                    </div>

                    {/* 3. Botcake Sample */}
                    <div>
                        <SectionHeader
                            icon={Bot}
                            title="Mẫu huấn luyện Botcake AI"
                            subtitle="Tự động đề xuất theo bộ lọc"
                            colorClass="from-cyan-500 to-blue-500 shadow-cyan-200/40"
                        />
                        <textarea
                            rows={5}
                            className={textareaClass}
                            placeholder="Chọn bộ lọc bên trái → mẫu tự xuất hiện..."
                            value={sampleBotcake}
                            onChange={(e) => setSampleBotcake(e.target.value)}
                        />
                    </div>
                </div>

                {/* Action Bar */}
                <div className="flex items-center gap-3 mt-5 pt-4 border-t border-slate-100">
                    <button
                        onClick={handleGenerate}
                        disabled={!canGenerate || isGenerating}
                        className={cn(
                            "flex items-center justify-center gap-2 rounded-xl px-8 py-3 text-sm font-bold transition-all duration-300 shadow-lg",
                            canGenerate && !isGenerating
                                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-200/50 hover:shadow-blue-300/60 hover:scale-[1.01] active:scale-[0.99]"
                                : "bg-slate-100 text-slate-300 cursor-not-allowed shadow-none"
                        )}
                    >
                        {isGenerating ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Đang phân tích...</>
                        ) : (
                            <><Wand2 className="h-4 w-4" /> Tạo kịch bản ({productImages.length} ảnh)</>
                        )}
                    </button>
                    <button
                        onClick={handleReset}
                        className="rounded-xl px-4 py-3 text-sm font-medium text-slate-400 border border-slate-200 hover:bg-slate-50 hover:text-slate-600 transition-all flex items-center gap-2"
                    >
                        <Trash2 className="h-3.5 w-3.5" /> Xóa tất cả
                    </button>
                </div>
            </div>

            {/* Error */}
            {output?.error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3 mb-4">
                    <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-red-600">Lỗi phân tích</p>
                        <p className="text-xs text-red-400 mt-1">{output.error}</p>
                    </div>
                </div>
            )}

            {/* ═══ 3-COLUMN LAYOUT ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* LEFT — 3 Kịch bản chào hàng */}
                <div className="flex flex-col gap-3">
                    <OutputCard
                        icon={Sparkles}
                        label="🇻🇳 Kịch bản Tiếng Việt"
                        content={output?.pitchVi || ""}
                        emptyText="Upload ảnh → nhấn Tạo kịch bản"
                        gradientClass="bg-gradient-to-br from-amber-50/50 to-orange-50/30"
                        iconColorClass="text-amber-500"
                        isLoading={isGenerating}
                    />
                    <OutputCard
                        icon={Sparkles}
                        label="🇬🇧 Sales Pitch (English)"
                        content={output?.pitchEn || ""}
                        emptyText="English version"
                        gradientClass="bg-gradient-to-br from-blue-50/50 to-sky-50/30"
                        iconColorClass="text-blue-500"
                        isLoading={isGenerating}
                    />
                    <OutputCard
                        icon={Sparkles}
                        label="🇵🇭 Sales Pitch (Filipino)"
                        content={output?.pitchPh || ""}
                        emptyText="Filipino version"
                        gradientClass="bg-gradient-to-br from-red-50/50 to-rose-50/30"
                        iconColorClass="text-red-500"
                        isLoading={isGenerating}
                    />
                    {/* Nút đẩy Pancake + chọn shop */}
                    {output && output.pitchVi && (
                        <div className="flex flex-col gap-2">
                            <select
                                value={selectedShopId}
                                onChange={(e) => setSelectedShopId(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
                            >
                                {shops.map((shop) => (
                                    <option key={shop.shop_id} value={shop.shop_id}>
                                        {shop.name}
                                    </option>
                                ))}
                            </select>
                            <SyncButton
                                icon={Send}
                                label={syncPancake === 'success' ? '✅ Đã đẩy lên Pancake' : syncPancake === 'error' ? '❌ Lỗi — thử lại' : '📤 Đẩy lên Pancake'}
                                onClick={handlePushPancake}
                                isLoading={syncPancake === 'loading'}
                                variant="pancake"
                            />
                        </div>
                    )}
                </div>

                {/* MIDDLE — 2 Botcake boxes */}
                <div className="flex flex-col gap-3">
                    <OutputCard
                        icon={Bot}
                        label="🤖 Botcake (Tiếng Việt)"
                        content={output?.botcakeVi || ""}
                        emptyText="Botcake tiếng Việt"
                        gradientClass="bg-gradient-to-br from-cyan-50/50 to-blue-50/30"
                        iconColorClass="text-cyan-500"
                        isLoading={isGenerating}
                    />
                    <OutputCard
                        icon={Bot}
                        label="🤖 Botcake (English)"
                        content={output?.botcakeEn || ""}
                        emptyText="Botcake English"
                        gradientClass="bg-gradient-to-br from-teal-50/50 to-cyan-50/30"
                        iconColorClass="text-teal-500"
                        isLoading={isGenerating}
                    />
                    {/* Nút tải Botcake training file */}
                    {output && output.botcakeVi && (
                        <SyncButton
                            icon={Download}
                            label={syncBotcake === 'success' ? '✅ Đã tải file' : '🤖 Tải file Botcake AI'}
                            onClick={handleDownloadBotcake}
                            isLoading={syncBotcake === 'loading'}
                            variant="botcake"
                        />
                    )}
                </div>

                {/* RIGHT — Thành phần (3) + HDSD (3) */}
                <div className="flex flex-col gap-3">
                    <OutputCard
                        icon={FlaskConical}
                        label="🧪 Thành phần (VI)"
                        content={output?.ingredientsVi || ""}
                        emptyText="Thành phần tiếng Việt"
                        gradientClass="bg-gradient-to-br from-emerald-50/50 to-teal-50/30"
                        iconColorClass="text-emerald-500"
                        isLoading={isGenerating}
                    />
                    <OutputCard
                        icon={FlaskConical}
                        label="🧪 Ingredients (EN)"
                        content={output?.ingredientsEn || ""}
                        emptyText="Ingredients English"
                        gradientClass="bg-gradient-to-br from-green-50/50 to-emerald-50/30"
                        iconColorClass="text-green-500"
                        isLoading={isGenerating}
                    />
                    <OutputCard
                        icon={FlaskConical}
                        label="🧪 Sangkap (PH)"
                        content={output?.ingredientsPh || ""}
                        emptyText="Ingredients Filipino"
                        gradientClass="bg-gradient-to-br from-lime-50/50 to-green-50/30"
                        iconColorClass="text-lime-600"
                        isLoading={isGenerating}
                    />
                    <OutputCard
                        icon={BookOpen}
                        label="📋 HDSD (VI)"
                        content={output?.usageVi || ""}
                        emptyText="Hướng dẫn sử dụng"
                        gradientClass="bg-gradient-to-br from-violet-50/50 to-purple-50/30"
                        iconColorClass="text-violet-500"
                        isLoading={isGenerating}
                    />
                    <OutputCard
                        icon={BookOpen}
                        label="📋 Usage (EN)"
                        content={output?.usageEn || ""}
                        emptyText="Usage English"
                        gradientClass="bg-gradient-to-br from-purple-50/50 to-indigo-50/30"
                        iconColorClass="text-purple-500"
                        isLoading={isGenerating}
                    />
                    <OutputCard
                        icon={BookOpen}
                        label="📋 Paano gamitin (PH)"
                        content={output?.usagePh || ""}
                        emptyText="Usage Filipino"
                        gradientClass="bg-gradient-to-br from-fuchsia-50/50 to-purple-50/30"
                        iconColorClass="text-fuchsia-500"
                        isLoading={isGenerating}
                    />
                </div>
            </div>
        </div>
    );
}
