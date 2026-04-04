import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

// ─── Step 1: Vision — đọc TẤT CẢ ảnh của 1 sản phẩm ─────────────────────────
const VISION_PROMPT = `Bạn là chuyên gia phân tích sản phẩm. Tất cả ảnh này là CÁC GÓC KHÁC NHAU của CÙNG 1 SẢN PHẨM.
Hãy tổng hợp thông tin từ TẤT CẢ các ảnh:
1. Tên sản phẩm
2. Loại sản phẩm
3. Thành phần/nguyên liệu (đọc từ nhãn)
4. Hướng dẫn sử dụng (đọc từ nhãn)
5. Đặc điểm nổi bật
6. Text đọc được trên sản phẩm
7. Giá (nếu có)

Mô tả TOÀN BỘ thông tin tổng hợp từ các ảnh. Viết bằng tiếng Việt.`;

// ─── Step 2: Writer — viết kịch bản đa ngôn ngữ ──────────────────────────────
function getWriterPrompt(samplePitch?: string, currency?: string, priceCombo1?: string, priceCombo2?: string, langs?: string[]) {
    const activeLangs = langs || ['vi', 'en'];
    const hasEn = activeLangs.includes('en');
    const hasPh = activeLangs.includes('ph');
    const hasId = activeLangs.includes('id');
    const sectionCount = 3 + (hasEn ? 2 : 0) + (hasPh ? 2 : 0) + (hasId ? 2 : 0); // VI: pitch+ingredients+usage=3, EN/PH/ID add pitch+ingredients+usage each
    // Build pricing instruction
    const cur = currency || "USD";
    const p1 = priceCombo1 ? `${priceCombo1} ${cur}` : `[GIÁ] ${cur}`;
    const p2 = priceCombo2 ? `${priceCombo2} ${cur}` : `[GIÁ] ${cur}`;

    let prompt = `Bạn là copywriter bán hàng đa ngôn ngữ.
GIÁ: ${cur} only. Combo 1: ${p1}, Combo 2: ${p2}. KHÔNG dùng $, USD.

Viết ${sectionCount + 2} sections. Mỗi section bắt đầu bằng ===SECTION_NAME===
Mỗi bullet/emoji nằm trên 1 DÒNG RIÊNG.

===PITCH_VI===
${samplePitch?.trim() ? `COPY Y HỆT format, cấu trúc, emoji, giá, đồng tiền từ MẪU GỐC bên dưới.
CHỈ thay tên sản phẩm và lợi ích dựa trên ảnh.
KHÔNG thay đổi cấu trúc giá — giữ nguyên chính xác wording.` : `Viết kịch bản chào hàng tiếng Việt theo format:

❗ [Câu hỏi hook về vấn đề khách hàng]
❗ [Câu hỏi hook thứ 2]

✨ [TÊN SẢN PHẨM]

✔️ [Lợi ích 1]
✔️ [Lợi ích 2]
✔️ [Lợi ích 3]
✔️ [Lợi ích 4]

🔥 Ưu Đãi Dùng Thử Hôm Nay

🎁 Mua 1 Tặng 1 (Nhận 2 gói)
⭐ Giảm giá đến 60%
🚚 Miễn phí giao hàng
💵 Thanh toán khi nhận hàng (COD)

💎 Combo 1: ${p1} + Free Delivery
💎 Combo 2: ${p2} + Free Delivery 🔥BÁN CHẠY NHẤT🔥

🏆 Cam Kết Từ Chúng Tôi
✅ Hoàn tiền nếu bạn không hài lòng
⏳ Số lượng ưu đãi có hạn trong hôm nay

👉 Đặt hàng ngay để nhận ưu đãi!`}

===PITCH_EN===
${hasEn ? (samplePitch?.trim() ? `COPY Y HỆT format từ MẪU GỐC, dịch sang tiếng Anh. Giữ nguyên cấu trúc giá, emoji, đồng tiền.` : `Viết bản tiếng Anh cùng format, cùng emoji, cùng cấu trúc như bản tiếng Việt ở trên.`) : `Bỏ qua section này, viết "SKIP"`}

${hasPh ? `===PITCH_PH===
${samplePitch?.trim() ? `COPY Y HỆT format từ MẪU GỐC, dịch sang tiếng Filipino. Giữ nguyên cấu trúc giá, emoji, đồng tiền.` : `Viết bản tiếng Filipino cùng format, cùng emoji, cùng cấu trúc như bản tiếng Việt ở trên.`}` : ''}

${hasId ? `===PITCH_ID===
${samplePitch?.trim() ? `COPY Y HỆT format từ MẪU GỐC, dịch sang tiếng Indonesia (Bahasa Indonesia). Giữ nguyên cấu trúc giá, emoji, đồng tiền.` : `Viết bản tiếng Indonesia (Bahasa Indonesia) cùng format, cùng emoji, cùng cấu trúc như bản tiếng Việt ở trên.`}` : ''}

===INGREDIENTS_VI===
🧪 Thành phần:

🔹 [Thành phần 1] ([tên tiếng Anh])
🔹 [Thành phần 2] ([tên tiếng Anh])
🔹 [Thành phần 3]

👉 Công dụng chính:

✅ [Công dụng 1]
✅ [Công dụng 2]

${hasEn ? `===INGREDIENTS_EN===
🧪 Ingredients:

🔹 [Ingredient 1]
🔹 [Ingredient 2]

👉 Key benefits:

✅ [Benefit 1]
✅ [Benefit 2]` : ''}

${hasPh ? `===INGREDIENTS_PH===
🧪 Mga Sangkap:

🔹 [Sangkap 1]
🔹 [Sangkap 2]

👉 Pangunahing benepisyo:

✅ [Benepisyo 1]
✅ [Benepisyo 2]` : ''}

${hasId ? `===INGREDIENTS_ID===
🧪 Komposisi:

🔹 [Bahan 1]
🔹 [Bahan 2]

👉 Manfaat utama:

✅ [Manfaat 1]
✅ [Manfaat 2]` : ''}

===USAGE_VI===
📋 Cách sử dụng:

1️⃣ [Bước 1]
2️⃣ [Bước 2]
3️⃣ [Bước 3]

⚠️ Lưu ý: [lưu ý quan trọng]

${hasEn ? `===USAGE_EN===
📋 How to use:

1️⃣ [Step 1]
2️⃣ [Step 2]
3️⃣ [Step 3]

⚠️ Note: [important note]` : ''}

${hasPh ? `===USAGE_PH===
📋 Paano gamitin:

1️⃣ [Hakbang 1]
2️⃣ [Hakbang 2]
3️⃣ [Hakbang 3]

⚠️ Paalala: [mahalagang paalala]` : ''}

${hasId ? `===USAGE_ID===
📋 Cara penggunaan:

1️⃣ [Langkah 1]
2️⃣ [Langkah 2]
3️⃣ [Langkah 3]

⚠️ Catatan: [catatan penting]` : ''}
`;

    if (samplePitch?.trim()) {
        prompt += `\n\n🚨 MẪU GỐC — COPY Y HỆT format, emoji, giá, đồng tiền. CHỈ thay tên SP và lợi ích.
"""${samplePitch}"""`;
    }


    return prompt;
}

// ─── Parse sections from AI output ────────────────────────────────────────────
function parseSections(text: string) {
    const keys = [
        "pitchVi", "pitchEn", "pitchPh", "pitchId",
        "ingredientsVi", "ingredientsEn", "ingredientsPh", "ingredientsId",
        "usageVi", "usageEn", "usagePh", "usageId",
    ];

    const markers: Array<{ key: string; pattern: RegExp }> = [
        { key: "pitchVi", pattern: /===PITCH_VI===/i },
        { key: "pitchEn", pattern: /===PITCH_EN===/i },
        { key: "pitchPh", pattern: /===PITCH_PH===/i },
        { key: "pitchId", pattern: /===PITCH_ID===/i },
        { key: "ingredientsVi", pattern: /===INGREDIENTS_VI===/i },
        { key: "ingredientsEn", pattern: /===INGREDIENTS_EN===/i },
        { key: "ingredientsPh", pattern: /===INGREDIENTS_PH===/i },
        { key: "ingredientsId", pattern: /===INGREDIENTS_ID===/i },
        { key: "usageVi", pattern: /===USAGE_VI===/i },
        { key: "usageEn", pattern: /===USAGE_EN===/i },
        { key: "usagePh", pattern: /===USAGE_PH===/i },
        { key: "usageId", pattern: /===USAGE_ID===/i },
    ];

    const result: Record<string, string> = {};
    for (const k of keys) result[k] = "";

    // Find all marker positions
    const positions: Array<{ key: string; index: number; len: number }> = [];
    for (const m of markers) {
        const match = text.match(m.pattern);
        if (match && match.index !== undefined) {
            positions.push({ key: m.key, index: match.index, len: match[0].length });
        }
    }

    // Sort by position
    positions.sort((a, b) => a.index - b.index);

    // Extract content between markers
    for (let i = 0; i < positions.length; i++) {
        const start = positions[i].index + positions[i].len;
        const end = i + 1 < positions.length ? positions[i + 1].index : text.length;
        result[positions[i].key] = text.substring(start, end).trim();
    }

    // If no markers found, put everything in pitchVi
    if (positions.length === 0) {
        result.pitchVi = text.trim();
    }

    return result;
}


export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { imageBase64, images, mediaType, samplePitch, country, currency, priceCombo1, priceCombo2, langs } = body;
        const activeLangs: string[] = Array.isArray(langs) ? langs : ['vi', 'en'];

        const imageList: Array<{ base64: string; mimeType: string }> = [];
        if (images && Array.isArray(images)) {
            for (const img of images) {
                imageList.push({ base64: img.base64, mimeType: img.mimeType || "image/jpeg" });
            }
        } else if (imageBase64) {
            imageList.push({ base64: imageBase64, mimeType: mediaType || "image/jpeg" });
        }

        if (imageList.length === 0) {
            return NextResponse.json({ error: "Thiếu ảnh sản phẩm" }, { status: 400 });
        }

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Chưa cấu hình GROQ_API_KEY" }, { status: 500 });
        }

        const groq = new Groq({ apiKey });

        // ══════ STEP 1: Vision (batch max 5 images per request) ══════
        const MAX_IMAGES_PER_BATCH = 5;
        const batches: Array<Array<{ base64: string; mimeType: string }>> = [];
        for (let i = 0; i < imageList.length; i += MAX_IMAGES_PER_BATCH) {
            batches.push(imageList.slice(i, i + MAX_IMAGES_PER_BATCH));
        }

        const descriptions: string[] = [];
        for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
            const batch = batches[batchIdx];
            const imageParts = batch.map((img) => ({
                type: "image_url" as const,
                image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
            }));

            const batchLabel = batches.length > 1
                ? `Đây là ảnh nhóm ${batchIdx + 1}/${batches.length} (${batch.length} ảnh) của CÙNG 1 sản phẩm. Tổng hợp tất cả thông tin.`
                : `Đây là ${batch.length} ảnh của CÙNG 1 sản phẩm. Tổng hợp tất cả thông tin.`;

            const visionResult = await groq.chat.completions.create({
                model: "meta-llama/llama-4-scout-17b-16e-instruct",
                max_tokens: 2000,
                messages: [
                    { role: "system", content: VISION_PROMPT },
                    {
                        role: "user",
                        content: [
                            ...imageParts,
                            { type: "text", text: batchLabel },
                        ],
                    },
                ],
            });

            const desc = visionResult.choices[0]?.message?.content || "";
            if (desc.trim()) descriptions.push(desc.trim());
        }

        const productDescription = descriptions.length > 1
            ? descriptions.map((d, i) => `[Nhóm ảnh ${i + 1}]\n${d}`).join("\n\n")
            : descriptions[0] || "";

        if (!productDescription.trim()) {
            return NextResponse.json(
                { error: "Không thể đọc thông tin từ ảnh. Thử ảnh khác rõ hơn." },
                { status: 400 }
            );
        }

        // ══════ STEP 2: Writer 70B — dynamic sections based on langs ══════
        const sectionCount = 5 + (activeLangs.includes('en') ? 4 : 0) + (activeLangs.includes('ph') ? 2 : 0) + (activeLangs.includes('id') ? 4 : 0);
        const maxOutputTokens = Math.min(2000 + activeLangs.length * 1500, 8000);
        const writerResult = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            max_tokens: maxOutputTokens,
            temperature: 0.7,
            messages: [
                { role: "system", content: getWriterPrompt(samplePitch, currency, priceCombo1, priceCombo2, activeLangs) },
                {
                    role: "user",
                    content: `Thông tin sản phẩm:\n\n${productDescription}\n\nViết nội dung marketing đầy đủ tất cả ${sectionCount} sections. KHÔNG JSON, dùng ===SECTION=== markers.`,
                },
            ],
        });

        const rawText = writerResult.choices[0]?.message?.content || "";
        const p = parseSections(rawText);


        return NextResponse.json({
            pitchVi: p.pitchVi,
            pitchEn: p.pitchEn,
            pitchPh: p.pitchPh,
            pitchId: p.pitchId,
            ingredientsVi: p.ingredientsVi,
            ingredientsEn: p.ingredientsEn,
            ingredientsPh: p.ingredientsPh,
            ingredientsId: p.ingredientsId,
            usageVi: p.usageVi,
            usageEn: p.usageEn,
            usagePh: p.usagePh,
            usageId: p.usageId,
            provider: "groq-2step",
        });
    } catch (error: unknown) {
        console.error("[analyze-product] Error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: `Lỗi phân tích: ${message}` }, { status: 500 });
    }
}
