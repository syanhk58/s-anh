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

interface Config {
    poscake: {
        api_url: string;
        shops: ShopConfig[];
    };
}

interface OrderItem {
    id: string | number;
    status: number;
    total_price: number;
    total_price_after_sub_discount: number;
    shipping_fee: number;
    cod: number;
    page_id: string;
    shipping_address: {
        full_name: string;
        phone_number: string;
        full_address: string;
        province_name: string;
    };
    items_length: number;
    total_quantity: number;
    ads_source: string;
    inserted_at: string;
    updated_at: string;
    time_send_partner: string;
    note: string;
    page: { id: string; name: string };
    marketer: { name: string } | null;
    last_editor: { name: string } | null;
    assigning_seller: { name: string } | null;
}

// Status mapping
const STATUS_MAP: Record<number, string> = {
    0: "Mới",
    1: "Xác nhận",
    2: "Chờ hàng",
    3: "Đang giao",
    4: "Đã giao",
    5: "Hoàn thành",
    6: "Đang đóng hàng",
    8: "Đã đặt hàng",
    10: "Hoàn thành",
    11: "Đang đóng hàng",
    20: "Đã gửi đối tác",
    [-1]: "Hủy",
    [-2]: "Trả hàng",
};

function loadConfig(): Config {
    const configPath = path.join(process.cwd(), "config", "script-generator.yaml");
    const raw = fs.readFileSync(configPath, "utf-8");
    return yaml.load(raw) as Config;
}

// ─── GET: Lấy đơn POS theo page hoặc danh sách pages ─────────────────────────
// Query params:
//   ?action=pages              → Danh sách tất cả pages trong tất cả shops
//   ?action=orders&page_id=XXX → Đơn hàng của 1 page (phân trang)
//   ?action=summary&page_id=XXX → Tổng hợp nhanh (tổng đơn, doanh thu, theo status)
//   &shop_name=Saudi           → Filter theo shop (optional)
//   &page_number=1             → Phân trang (default: 1)
export async function GET(req: NextRequest) {
    try {
        const config = loadConfig();
        const { searchParams } = new URL(req.url);
        const action = searchParams.get("action") || "pages";
        const shopNameFilter = searchParams.get("shop_name") || "";

        // ═══════════════════════════════════════════════════════════════════
        // ACTION: pages — Trả về danh sách tất cả pages + shop info
        // ═══════════════════════════════════════════════════════════════════
        if (action === "pages") {
            const allShops = await Promise.all(
                config.poscake.shops
                    .filter(s => !shopNameFilter || s.name.toLowerCase() === shopNameFilter.toLowerCase())
                    .map(async (s) => {
                        let pages: Array<{ id: string; name: string; platform: string }> = [];
                        try {
                            const res = await fetch(
                                `${config.poscake.api_url}/shops?api_key=${s.api_key}`,
                                { next: { revalidate: 300 } }
                            );
                            if (res.ok) {
                                const data = await res.json();
                                for (const shop of (data.shops || [])) {
                                    for (const p of (shop.pages || [])) {
                                        pages.push({
                                            id: p.id,
                                            name: p.name,
                                            platform: p.platform || "facebook",
                                        });
                                    }
                                }
                            }
                        } catch {
                            console.warn(`[orders] Lỗi lấy pages shop ${s.name}`);
                        }
                        return {
                            shop_name: s.name,
                            shop_id: s.shop_id,
                            total_pages: pages.length,
                            pages,
                        };
                    })
            );

            const totalPages = allShops.reduce((sum, s) => sum + s.total_pages, 0);
            return NextResponse.json({
                success: true,
                total_pages: totalPages,
                shops: allShops,
            });
        }

        // ═══════════════════════════════════════════════════════════════════
        // ACTION: orders — Lấy đơn POS theo page_id (có phân trang)
        // ═══════════════════════════════════════════════════════════════════
        if (action === "orders") {
            const pageId = searchParams.get("page_id");
            if (!pageId) {
                return NextResponse.json({ error: "Thiếu page_id" }, { status: 400 });
            }

            const pageNumber = parseInt(searchParams.get("page_number") || "1");

            // Tìm shop chứa page này
            const shopConfig = await findShopForPage(config, pageId);
            if (!shopConfig) {
                return NextResponse.json({
                    error: `Không tìm thấy page ${pageId} trong bất kỳ shop nào`,
                }, { status: 404 });
            }

            const url = `${config.poscake.api_url}/shops/${shopConfig.shop_id}/orders?api_key=${shopConfig.api_key}&page_id=${pageId}&page_number=${pageNumber}`;
            const res = await fetch(url);
            const data = await res.json();

            const orders = (data.data || []).map((o: OrderItem) => ({
                id: o.id,
                status: o.status,
                status_name: STATUS_MAP[o.status] || `Status ${o.status}`,
                customer_name: o.shipping_address?.full_name || "",
                phone: o.shipping_address?.phone_number || "",
                address: o.shipping_address?.full_address || "",
                province: o.shipping_address?.province_name || "",
                cod: o.cod || 0,
                total_price: o.total_price_after_sub_discount || 0,
                shipping_fee: o.shipping_fee || 0,
                items_count: o.items_length || 0,
                quantity: o.total_quantity || 0,
                ads_source: o.ads_source || "",
                page_name: o.page?.name || "",
                marketer: o.marketer?.name || "",
                seller: o.assigning_seller?.name || "",
                last_editor: o.last_editor?.name || "",
                note: o.note || "",
                created_at: o.inserted_at || "",
                updated_at: o.updated_at || "",
            }));

            return NextResponse.json({
                success: true,
                shop_name: shopConfig.name,
                shop_id: shopConfig.shop_id,
                page_id: pageId,
                page_number: data.page_number || pageNumber,
                page_size: data.page_size || 10,
                total_entries: data.total_entries || 0,
                total_pages: data.total_pages || 0,
                orders,
            });
        }

        // ═══════════════════════════════════════════════════════════════════
        // ACTION: summary — Tổng hợp nhanh đơn POS theo page
        // ═══════════════════════════════════════════════════════════════════
        if (action === "summary") {
            const pageId = searchParams.get("page_id");
            if (!pageId) {
                return NextResponse.json({ error: "Thiếu page_id" }, { status: 400 });
            }

            const shopConfig = await findShopForPage(config, pageId);
            if (!shopConfig) {
                return NextResponse.json({
                    error: `Không tìm thấy page ${pageId} trong bất kỳ shop nào`,
                }, { status: 404 });
            }

            // Lấy tất cả đơn (phân trang)
            const allOrders: OrderItem[] = [];
            let currentPage = 1;
            let totalPages = 1;

            while (currentPage <= totalPages) {
                const url = `${config.poscake.api_url}/shops/${shopConfig.shop_id}/orders?api_key=${shopConfig.api_key}&page_id=${pageId}&page_number=${currentPage}`;
                const res = await fetch(url);
                const data = await res.json();
                allOrders.push(...(data.data || []));
                totalPages = data.total_pages || 1;
                currentPage++;
            }

            // Thống kê
            const statusBreakdown: Record<string, number> = {};
            let totalCOD = 0;
            let totalRevenue = 0;

            for (const o of allOrders) {
                const statusName = STATUS_MAP[o.status] || `Status ${o.status}`;
                statusBreakdown[statusName] = (statusBreakdown[statusName] || 0) + 1;
                totalCOD += o.cod || 0;
                totalRevenue += o.total_price_after_sub_discount || 0;
            }

            return NextResponse.json({
                success: true,
                shop_name: shopConfig.name,
                page_id: pageId,
                page_name: allOrders[0]?.page?.name || pageId,
                total_orders: allOrders.length,
                total_cod: totalCOD,
                total_revenue: totalRevenue,
                status_breakdown: statusBreakdown,
            });
        }

        return NextResponse.json({ error: "action không hợp lệ. Dùng: pages, orders, summary" }, { status: 400 });

    } catch (error: unknown) {
        console.error("[pancake/orders] GET error:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── Helper: Tìm shop chứa 1 page_id ─────────────────────────────────────────
async function findShopForPage(config: Config, pageId: string): Promise<ShopConfig | null> {
    for (const shop of config.poscake.shops) {
        try {
            const res = await fetch(
                `${config.poscake.api_url}/shops?api_key=${shop.api_key}`,
                { next: { revalidate: 300 } }
            );
            if (res.ok) {
                const data = await res.json();
                for (const s of (data.shops || [])) {
                    for (const p of (s.pages || [])) {
                        if (String(p.id) === String(pageId)) {
                            return shop;
                        }
                    }
                }
            }
        } catch {
            continue;
        }
    }
    return null;
}
