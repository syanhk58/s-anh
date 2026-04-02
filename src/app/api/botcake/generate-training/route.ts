import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// ─── Botcake Training File Generator ──────────────────────────────────────────
// Đọc template gốc từ config/botcake-template.txt
// CHỈ thay thế các placeholder sản phẩm, GIỮ NGUYÊN toàn bộ quy tắc/cấu trúc
// ────────────────────────────────────────────────────────────────────────────────

interface GenerateTrainingRequest {
    botcakeVi: string;
    botcakeEn: string;
    ingredientsVi: string;
    ingredientsEn: string;
    usageVi: string;
    usageEn: string;
    productName?: string;
    pitchVi?: string;
    pitchEn?: string;
}

function buildFromTemplate(data: GenerateTrainingRequest): string {
    const templatePath = path.join(process.cwd(), "config", "botcake-template.txt");
    let template = fs.readFileSync(templatePath, "utf-8");

    const name = data.productName || "Sản phẩm";

    // ─── Build replacement values ───
    const benefits = [
        data.ingredientsVi,
        data.ingredientsEn,
    ].filter(Boolean).join("\n\n") || "Deep hydration, skin cell repair, antioxidant protection.";

    const ingredients = [
        data.ingredientsVi ? `[Vietnamese]\n${data.ingredientsVi}` : "",
        data.ingredientsEn ? `[English]\n${data.ingredientsEn}` : "",
    ].filter(Boolean).join("\n\n") || "[Chưa có thông tin thành phần]";

    const usage = [
        data.usageVi ? `[Vietnamese]\n${data.usageVi}` : "",
        data.usageEn ? `[English]\n${data.usageEn}` : "",
    ].filter(Boolean).join("\n\n") || "[Chưa có hướng dẫn sử dụng]";

    const chatbotScripts = [
        data.botcakeVi ? `  [Vietnamese Chatbot Script]\n${data.botcakeVi}` : "",
        data.botcakeEn ? `  [English Chatbot Script]\n${data.botcakeEn}` : "",
    ].filter(Boolean).join("\n\n") || "[Chưa có kịch bản chatbot]";

    const pricing = `  - Combo 1: [CẦN ĐIỀN GIÁ]\n  - Combo 2: [CẦN ĐIỀN GIÁ]`;

    // ─── Replace placeholders ───
    template = template.replace(/\{\{PRODUCT_NAME\}\}/g, name);
    template = template.replace(/\{\{PRODUCT_BENEFITS\}\}/g, benefits);
    template = template.replace(/\{\{PRODUCT_INGREDIENTS\}\}/g, ingredients);
    template = template.replace(/\{\{PRODUCT_USAGE\}\}/g, usage);
    template = template.replace(/\{\{PRICING_OFFERS\}\}/g, pricing);
    template = template.replace(/\{\{CHATBOT_SCRIPTS\}\}/g, chatbotScripts);
    template = template.replace(/\{\{PRODUCT_IMAGE_1\}\}/g, "[CẦN ĐIỀN URL ẢNH SP 1]");
    template = template.replace(/\{\{PRODUCT_IMAGE_2\}\}/g, "[CẦN ĐIỀN URL ẢNH SP 2]");
    template = template.replace(/\{\{FEEDBACK_IMAGES\}\}/g, "[CẦN ĐIỀN URL ẢNH FEEDBACK]");

    return template;
}

export async function POST(req: NextRequest) {
    try {
        const body: GenerateTrainingRequest = await req.json();

        const content = buildFromTemplate(body);
        const productName = body.productName || "product";
        const slug = productName.replace(/\s+/g, "_").toLowerCase().replace(/[^a-z0-9_]/g, "");
        const fileName = `botcake_${slug}_${Date.now()}.txt`;

        return new NextResponse(content, {
            status: 200,
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Content-Disposition": `attachment; filename="${fileName}"`,
            },
        });
    } catch (error: unknown) {
        console.error("[botcake/generate-training] Error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: `Lỗi: ${message}` }, { status: 500 });
    }
}
