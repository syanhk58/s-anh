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
    pancake_crm: {
        api_url: string;
        api_token: string;
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
        const jwt = config.pancake_crm.api_token;
        const crmUrl = config.pancake_crm.api_url;

        // ══════ STEP 1: Fetch pages từ POS API (qua shop API key) ══════
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
                    console.warn(`[pancake] Không lấy được pages cho shop ${s.name}`);
                }
                return {
                    name: s.name,
                    shop_id: s.shop_id,
                    pages,
                };
            })
        );

        // ══════ STEP 2: Fetch TẤT CẢ pages từ CRM API (bao gồm pages mới, admin) ══════
        // Collect all POS page IDs for dedup
        const posPageIds = new Set<string>();
        for (const shop of shopsWithPages) {
            for (const page of shop.pages) {
                posPageIds.add(String(page.id));
            }
        }

        // Map shop_id → shop index for grouping CRM pages into existing shops
        const shopIdToIndex = new Map<string, number>();
        shopsWithPages.forEach((s, i) => shopIdToIndex.set(s.shop_id, i));

        let extraPages: Array<{ id: string; name: string; platform: string }> = [];

        if (jwt) {
            try {
                const crmRes = await fetch(
                    `${crmUrl}/pages?access_token=${jwt}`,
                    { next: { revalidate: 300 } }
                );
                if (crmRes.ok) {
                    const crmData = await crmRes.json();
                    // CRM response: { categorized: { activated: [...pages] } }
                    const activatedPages = crmData?.categorized?.activated || [];

                    for (const p of activatedPages) {
                        const pageId = String(p.id);
                        // Skip pages already in POS shops
                        if (posPageIds.has(pageId)) continue;

                        const pageObj = {
                            id: pageId,
                            name: p.name || `Page ${pageId}`,
                            platform: p.platform || "facebook",
                        };

                        // Try to group into existing shop by shop_id
                        const pShopId = p.shop_id ? String(p.shop_id) : null;
                        if (pShopId && shopIdToIndex.has(pShopId)) {
                            shopsWithPages[shopIdToIndex.get(pShopId)!].pages.push(pageObj);
                            posPageIds.add(pageId); // mark as added
                        } else {
                            extraPages.push(pageObj);
                        }
                    }
                }
            } catch (err) {
                console.warn("[pancake] Không lấy được pages từ CRM API:", err);
            }
        }

        // ══════ STEP 3: Thêm nhóm "Pages khác (CRM)" cho pages không thuộc shop nào ══════
        const result = [...shopsWithPages];
        if (extraPages.length > 0) {
            result.push({
                name: "Pages khác (CRM)",
                shop_id: "__crm_extra__",
                pages: extraPages,
            });
        }

        return NextResponse.json({ shops: result });
    } catch (error: unknown) {
        console.error("[pancake/push-template] GET Error:", error);
        return NextResponse.json({ error: "Không đọc được config" }, { status: 500 });
    }
}

// ─── POST: Push Quick Reply Templates via Pancake Settings API ────────────────
interface PushTemplateRequest {
    shopId: string;
    pageId: string;        // page Facebook ID được chọn
    pitchVi: string;
    pitchEn: string;
    pitchPh: string;
    pitchId: string;
    productName?: string;
}

// Pancake Quick Reply message format
interface QuickReplyMessage {
    message: string;
    photos: string[];
    message_type: string;
    folders: string[];
    files: string[];
}

interface QuickReply {
    id?: string;
    messages: QuickReplyMessage[];
    shortcut: string;
    type_id: string | null;
}

export async function POST(req: NextRequest) {
    try {
        const body: PushTemplateRequest = await req.json();
        const { shopId, pageId, pitchVi, pitchEn, pitchPh, pitchId, productName } = body;

        if (!pageId) {
            return NextResponse.json({ error: "Chưa chọn page Pancake" }, { status: 400 });
        }

        const config = loadConfig();
        const shop = config.poscake.shops.find((s) => s.shop_id === shopId);
        const jwt = config.pancake_crm.api_token;

        if (!jwt) {
            return NextResponse.json({ error: "Thiếu JWT token (pancake_crm.api_token)" }, { status: 500 });
        }

        // ══════ STEP 1: GET current settings ══════
        const settingsUrl = `https://pancake.vn/api/v1/pages/${pageId}/settings?access_token=${jwt}`;
        const getRes = await fetch(settingsUrl);

        if (!getRes.ok) {
            return NextResponse.json({
                error: `Không thể lấy settings page ${pageId}: HTTP ${getRes.status}`,
            }, { status: 500 });
        }

        const settingsData = await getRes.json();
        const settings = settingsData.settings;

        if (!settings) {
            return NextResponse.json({ error: "Không có settings cho page này" }, { status: 500 });
        }

        const currentKey = settings.current_settings_key;
        const existingQR: QuickReply[] = settings.quick_replies || [];

        // ══════ STEP 2: Build new Quick Replies ══════
        const label = productName || "Sản phẩm";
        const timestamp = new Date().toLocaleDateString("vi-VN");
        const slug = label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

        // Find the "Chào Hàng" type_id from existing types
        const quickReplyTypes = settings.quick_reply_types || [];
        const chaoHangType = quickReplyTypes.find(
            (t: { id: string; text: string }) => t.text.toLowerCase().includes("chào") || t.text.toLowerCase().includes("chao")
        );
        const typeId = chaoHangType?.id || null;

        // Build templates - only add languages with content
        const templatesToAdd: Array<{ shortcut: string; text: string; label: string }> = [];
        
        if (pitchVi?.trim()) {
            templatesToAdd.push({ shortcut: `${slug}_vi`, text: pitchVi, label: `🇻🇳 ${label}` });
        }
        if (pitchEn?.trim()) {
            templatesToAdd.push({ shortcut: `${slug}_en`, text: pitchEn, label: `🇬🇧 ${label} EN` });
        }
        if (pitchPh?.trim()) {
            templatesToAdd.push({ shortcut: `${slug}_ph`, text: pitchPh, label: `🇵🇭 ${label} PH` });
        }
        if (pitchId?.trim()) {
            templatesToAdd.push({ shortcut: `${slug}_id`, text: pitchId, label: `🇮🇩 ${label} ID` });
        }

        if (templatesToAdd.length === 0) {
            return NextResponse.json({ error: "Không có nội dung nào để đẩy" }, { status: 400 });
        }

        // Append new QRs to existing list
        const newQRs: QuickReply[] = templatesToAdd.map((tpl) => ({
            messages: [{
                message: tpl.text,
                photos: [],
                message_type: "",
                folders: [],
                files: [],
            }],
            shortcut: tpl.shortcut,
            type_id: typeId,
        }));

        const updatedQR = [...existingQR, ...newQRs];

        // ══════ STEP 3: POST updated settings ══════
        const changes = JSON.stringify({ quick_replies: updatedQR });

        const formData = new URLSearchParams();
        formData.append("changes", changes);
        formData.append("current_settings_key", currentKey);

        const postRes = await fetch(settingsUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Origin": "https://pancake.vn",
                "Referer": `https://pancake.vn/${pageId}/setting/reply`,
            },
            body: formData.toString(),
        });

        if (!postRes.ok) {
            const errText = await postRes.text();
            return NextResponse.json({
                error: `Lỗi khi đẩy lên Pancake: HTTP ${postRes.status} - ${errText.slice(0, 200)}`,
            }, { status: 500 });
        }

        const postData = await postRes.json();
        const newCount = postData?.change_settings?.quick_replies?.length || updatedQR.length;

        return NextResponse.json({
            success: true,
            message: `✅ Đã tạo ${templatesToAdd.length} Quick Reply trên page ${pageId} (shop ${shop?.name || shopId}). Tổng: ${newCount} mẫu.`,
            shopName: shop?.name || shopId,
            added: templatesToAdd.map(t => t.label),
            totalCount: newCount,
        });

    } catch (error: unknown) {
        console.error("[pancake/push-template] Error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: `Lỗi: ${message}` }, { status: 500 });
    }
}
