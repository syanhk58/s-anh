import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ShopConfig {
    name: string;
    api_key: string;
    shop_id: string;
}

interface ScriptGeneratorConfig {
    poscake: {
        api_url: string;
        shops: ShopConfig[];
    };
}

// ─── Load config ──────────────────────────────────────────────────────────────
function loadConfig(): ScriptGeneratorConfig {
    const configPath = path.join(process.cwd(), "config", "script-generator.yaml");
    const raw = fs.readFileSync(configPath, "utf-8");
    return yaml.load(raw) as ScriptGeneratorConfig;
}

// ─── GET: Trả về danh sách shops + pages ──────────────────────────────────────
export async function GET() {
    try {
        const config = loadConfig();
        const apiUrl = config.poscake.api_url;

        // Fetch pages cho mỗi shop từ Pancake API
        const shopsWithPages = await Promise.all(
            config.poscake.shops.map(async (s) => {
                let pages: Array<{ id: string; name: string; platform: string }> = [];
                try {
                    const res = await fetch(
                        `${apiUrl}/shops?api_key=${s.api_key}`,
                        { next: { revalidate: 300 } } // cache 5 phút
                    );
                    if (res.ok) {
                        const data = await res.json();
                        if (data.shops && Array.isArray(data.shops)) {
                            // Lấy tất cả pages từ tất cả shops returned
                            for (const shop of data.shops) {
                                if (shop.pages && Array.isArray(shop.pages)) {
                                    pages.push(
                                        ...shop.pages.map((p: { id: string; name: string; platform?: string }) => ({
                                            id: p.id,
                                            name: p.name,
                                            platform: p.platform || "facebook",
                                        }))
                                    );
                                }
                            }
                        }
                    }
                } catch {
                    // Nếu fetch pages thất bại, trả về shop không có pages
                    console.warn(`[pancake] Không lấy được pages cho shop ${s.name}`);
                }
                return {
                    name: s.name,
                    shop_id: s.shop_id,
                    pages,
                };
            })
        );

        return NextResponse.json({ shops: shopsWithPages });
    } catch (error: unknown) {
        console.error("[pancake/push-template] GET Error:", error);
        return NextResponse.json({ error: "Không đọc được config" }, { status: 500 });
    }
}

// ─── POST: Push Quick Reply Templates ─────────────────────────────────────────
interface PushTemplateRequest {
    shopId: string;       // shop_id để xác định dùng key nào
    pitchVi: string;
    pitchEn: string;
    pitchPh: string;
    pitchId: string;
    productName?: string;
}

export async function POST(req: NextRequest) {
    try {
        const body: PushTemplateRequest = await req.json();
        const { shopId, pitchVi, pitchEn, pitchPh, pitchId, productName } = body;

        if (!shopId) {
            return NextResponse.json({ error: "Chưa chọn shop" }, { status: 400 });
        }

        const config = loadConfig();
        const shop = config.poscake.shops.find((s) => s.shop_id === shopId);

        if (!shop) {
            return NextResponse.json({ error: `Không tìm thấy shop ID: ${shopId}` }, { status: 404 });
        }

        const apiUrl = config.poscake.api_url;
        const label = productName || "Sản phẩm mới";
        const timestamp = new Date().toLocaleDateString("vi-VN");
        const slug = label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

        // Tạo 4 quick reply templates (VI, EN, PH, ID)
        const templates = [
            { shortcut: `/${slug}_vi`, text: pitchVi, name: `🇻🇳 ${label} (${timestamp})` },
            { shortcut: `/${slug}_en`, text: pitchEn, name: `🇬🇧 ${label} EN (${timestamp})` },
            { shortcut: `/${slug}_ph`, text: pitchPh, name: `🇵🇭 ${label} PH (${timestamp})` },
            { shortcut: `/${slug}_id`, text: pitchId, name: `🇮🇩 ${label} ID (${timestamp})` },
        ];

        const results: Array<{ lang: string; success: boolean; error?: string }> = [];

        for (const tpl of templates) {
            if (!tpl.text?.trim()) {
                results.push({ lang: tpl.name, success: false, error: "Nội dung trống" });
                continue;
            }

            try {
                const res = await fetch(
                    `${apiUrl}/shops/${shop.shop_id}/quick_replies?api_key=${shop.api_key}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name: tpl.name,
                            shortcut: tpl.shortcut,
                            text: tpl.text,
                        }),
                    }
                );

                if (res.ok) {
                    results.push({ lang: tpl.name, success: true });
                } else {
                    const errData = await res.json().catch(() => ({}));
                    results.push({
                        lang: tpl.name,
                        success: false,
                        error: errData?.message || `HTTP ${res.status}`,
                    });
                }
            } catch (err) {
                results.push({
                    lang: tpl.name,
                    success: false,
                    error: err instanceof Error ? err.message : "Network error",
                });
            }
        }

        const successCount = results.filter((r) => r.success).length;
        const allSuccess = successCount === results.length;

        return NextResponse.json({
            success: allSuccess,
            message: allSuccess
                ? `✅ Đã tạo ${successCount} Quick Reply Templates trên shop ${shop.name}!`
                : `⚠️ ${successCount}/${results.length} thành công trên shop ${shop.name}.`,
            shopName: shop.name,
            results,
        });
    } catch (error: unknown) {
        console.error("[pancake/push-template] Error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: `Lỗi: ${message}` }, { status: 500 });
    }
}
