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
function getWriterPrompt(samplePitch?: string, sampleBotcake?: string, currency?: string, priceCombo1?: string, priceCombo2?: string, langs?: string[]) {
    const activeLangs = langs || ['vi', 'en'];
    const hasEn = activeLangs.includes('en');
    const hasPh = activeLangs.includes('ph');
    const hasId = activeLangs.includes('id');
    const sectionCount = 3 + (hasEn ? 2 : 0) + (hasPh ? 2 : 0) + (hasId ? 2 : 0); // VI always has 3 (pitch+botcake+ingredients+usage=5, but EN/PH/ID add 2 each)
    // Build pricing instruction
    const cur = currency || "USD";
    const p1 = priceCombo1 ? `${priceCombo1} ${cur}` : `[GIÁ] ${cur}`;
    const p2 = priceCombo2 ? `${priceCombo2} ${cur}` : `[GIÁ] ${cur}`;

    let prompt = `Bạn là copywriter chuyên viết kịch bản bán hàng đa ngôn ngữ.
QUY TẮC BẮT BUỘC VỀ GIÁ VÀ ĐỒNG TIỀN:
- ĐỒNG TIỀN BẮT BUỘC: ${cur} (KHÔNG dùng $, USD, hay đồng tiền khác)
- Combo 1 / Option 1: ${p1}
- Combo 2 / Option 2: ${p2}
- Mọi chỗ có giá phải ghi đúng ${cur}, ví dụ: "${p1}" không phải "$${priceCombo1 || '99'}"

Dựa vào ảnh sản phẩm, viết đầy đủ ${sectionCount + 2} sections.
Mỗi section bắt đầu bằng ===SECTION_NAME===
Mỗi bullet/emoji phải nằm trên 1 DÒNG RIÊNG, KHÔNG viết liền thành 1 đoạn. Viết text thuần với các section markers bên dưới.
Mỗi section bắt đầu bằng ===TÊN_SECTION=== trên 1 dòng riêng.
Mỗi bullet/emoji phải nằm trên 1 DÒNG RIÊNG, KHÔNG viết liền thành 1 đoạn.

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

===BOTCAKE_VI===
${sampleBotcake?.trim() ? `COPY Y HỆT format, labels, cấu trúc, giá, đồng tiền từ MẪU BOTCAKE bên dưới.
CHỈ thay tên sản phẩm và mô tả dựa trên ảnh.` : `Viết kịch bản chatbot tiếng Việt:

[Chào khách]: Chào bạn ơi! 👋 Bạn đang quan tâm đến sản phẩm nào ạ?
[Giới thiệu SP]: [2-3 câu giới thiệu ngắn]
[Hỏi nhu cầu]: Bạn muốn mua cho bản thân hay tặng người thân ạ?
[Trả lời giá]:
💎 Combo 1: ${p1}
💎 Combo 2: ${p2} ← Được chọn nhiều nhất!
🚚 Ship COD miễn phí
[Chốt đơn]: Bạn gửi mình: Tên + SĐT + Địa chỉ để mình xử lý ngay nhé! 📦
[Xác nhận]: Đã ghi nhận đơn! Giao trong 2-3 ngày. Cảm ơn bạn! 🙏`}

${hasEn ? `===BOTCAKE_EN===
${sampleBotcake?.trim() ? `COPY Y HỆT format từ MẪU BOTCAKE, dịch sang tiếng Anh. Giữ nguyên cấu trúc giá, emoji, đồng tiền.` : `Viết bản tiếng Anh của kịch bản chatbot, cùng format.`}` : ''}

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
        prompt += `\n\n🚨🚨🚨 QUAN TRỌNG NHẤT — MẪU KỊCH BẢN CHÀO HÀNG 🚨🚨🚨
ĐÂY LÀ FORMAT GỐC — BẮT BUỘC COPY Y HỆT:
- PHẢI giữ NGUYÊN cấu trúc giá VÀ wording từ mẫu (ví dụ: "Buy 1, get 1 free = 950 TWD" KHÔNG được viết thành "Combo 1: 950 TWD")
- PHẢI giữ NGUYÊN emoji, labels, thứ tự dòng
- CHỈ thay: tên sản phẩm, lợi ích, thành phần
- GIÁ VÀ ĐỒNG TIỀN đã đúng trong mẫu — KHÔNG thay đổi
- Nếu mẫu viết "Buy 1, get 1 free = X" thì output PHẢI viết "Buy 1, get 1 free = X"
- Nếu mẫu viết "Option 1: Buy 1 Get 1 = X" thì output PHẢI viết "Option 1: Buy 1 Get 1 = X"

MẪU GỐC (COPY Y HỆT FORMAT NÀY):
"""${samplePitch}"""`;
    }
    if (sampleBotcake?.trim()) {
        prompt += `\n\n🤖 MẪU BOTCAKE — BẮT BUỘC COPY Y HỆT:
- PHẢI giữ NGUYÊN format, labels, cấu trúc, emoji, giá, đồng tiền
- CHỈ thay nội dung sản phẩm (tên, thành phần, công dụng)
- GIÁ VÀ ĐỒNG TIỀN đã đúng trong mẫu — KHÔNG thay đổi
- KHÔNG thêm/bớt labels — giữ nguyên 100%
- KHÔNG viết lại cấu trúc giá — COPY y hệt

MẪU GỐC (COPY Y HỆT FORMAT NÀY):
"""${sampleBotcake}"""`;
    }

    return prompt;
}

// ─── Parse sections from AI output ────────────────────────────────────────────
function parseSections(text: string) {
    const keys = [
        "pitchVi", "pitchEn", "pitchPh", "pitchId",
        "botcakeVi", "botcakeEn", "botcakeId",
        "ingredientsVi", "ingredientsEn", "ingredientsPh", "ingredientsId",
        "usageVi", "usageEn", "usagePh", "usageId",
    ];

    const markers: Array<{ key: string; pattern: RegExp }> = [
        { key: "pitchVi", pattern: /===PITCH_VI===/i },
        { key: "pitchEn", pattern: /===PITCH_EN===/i },
        { key: "pitchPh", pattern: /===PITCH_PH===/i },
        { key: "pitchId", pattern: /===PITCH_ID===/i },
        { key: "botcakeVi", pattern: /===BOTCAKE_VI===/i },
        { key: "botcakeEn", pattern: /===BOTCAKE_EN===/i },
        { key: "botcakeId", pattern: /===BOTCAKE_ID===/i },
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

// ─── Build structured Botcake prompt from AI chatbot script ───────────────────
function buildStructuredBotcake(opts: {
    chatbotScript: string;
    productName: string;
    ingredients: string;
    usage: string;
    lang: "vi" | "en";
}): string {
    const { chatbotScript, ingredients, usage, lang } = opts;
    if (!chatbotScript.trim()) return "";

    // Extract product name from chatbot script if present
    const nameMatch = chatbotScript.match(/\[Giới thiệu SP\]:\s*(?:Mình có\s*)?(.+?)(?:\s*[—–-]|\.|\n)/i)
        || chatbotScript.match(/\[Introduce product\]:\s*(?:We have\s*)?(.+?)(?:\s*[—–-]|\.|\n)/i);
    const productName = nameMatch ? nameMatch[1].trim() : opts.productName;

    if (lang === "vi") {
        return `Role:
Chatbot bán hàng chuyên nghiệp, thân thiện, ngắn gọn cho sản phẩm ${productName}. Trả lời 1-3 câu ngắn, giọng ấm áp, emoji phù hợp. Luôn lịch sự và chuyên nghiệp.
---
Task:
- Chào khách hàng và giới thiệu sản phẩm
- Phát hiện hỏi giá → trả lời ngay với giá + ảnh sản phẩm
- Trả lời câu hỏi về công dụng, giao hàng, tồn kho, theo dõi đơn hàng
- Xử lý phản đối chuyên nghiệp
- Thu thập thông tin đặt hàng (tên, SĐT, địa chỉ) và xác nhận
- Xác minh địa chỉ, yêu cầu bổ sung nếu chưa rõ
- Chốt đơn hiệu quả trong 6-8 tin nhắn, tỉ lệ chuyển đổi 55-65%
- Kết thúc chuyên nghiệp sau xác nhận đơn hoặc khách từ chối
---
Context:
- Sản phẩm: ${productName}
- Thành phần & công dụng:
${ingredients || "[Thông tin thành phần từ ảnh sản phẩm]"}
- Hướng dẫn sử dụng:
${usage || "[Hướng dẫn từ ảnh sản phẩm]"}
- Kịch bản chatbot:
${chatbotScript}
---
Reasoning:
- Phát hiện keyword hỏi giá → trả lời ngay với giá + ảnh
- Câu hỏi hiệu quả → gửi feedback khách hàng + lợi ích
- Ảnh đã gửi → không gửi lại, tham chiếu ảnh trước
- Địa chỉ mơ hồ → yêu cầu bổ sung trước khi xác nhận
- Khách do dự → đề xuất giữ promo, max 2-3 lần nhắc nhẹ
- Khách từ chối rõ → dừng bán, kết thúc lịch sự
- Tin nhắn ngắn, thân thiện, có emoji
---
Output format:
- Câu ngắn, thân thiện (1-3 câu/tin nhắn)
- Emoji theo template (😍, 🎉, ✅, 🎁, 💎)
- Gửi URL ảnh đúng quy tắc, không trùng lặp
- Xác nhận đơn format rõ ràng với labels + emoji
---
Stop conditions:
- Kết thúc sau xác nhận đơn thành công
- Kết thúc nếu khách từ chối sau 2-3 lần nhắc
- Kết thúc nếu khách không phản hồi
- Không gửi ảnh/bán thêm sau khi đơn hoàn tất hoặc khách từ chối
---
--- End of structured prompt ---`;
    }

    // English version
    return `Role:
Professional, friendly, and concise sales chatbot for ${productName}. Use short 1-3 sentence responses with warm tone, empathy, and appropriate emoji. Maintain polite and professional demeanor.
---
Task:
- Greet customer and introduce product
- Detect price inquiries → respond immediately with pricing + product images
- Answer questions about effectiveness, delivery, stock, order tracking
- Handle objections professionally
- Collect order info (name, phone, city/area, address) and confirm orders
- Validate addresses, request details if unclear
- Close sales efficiently within 6-8 messages targeting 55-65% conversion
- End professionally after order confirmation or clear decline
---
Context:
- Product: ${productName}
- Ingredients & Benefits:
${ingredients || "[Product information from images]"}
- Usage:
${usage || "[Usage instructions from images]"}
- Chatbot Scripts:
${chatbotScript}
---
Reasoning:
- On detected price keyword → respond immediately with pricing + images
- Effectiveness questions → send customer feedback images + benefits
- Images already sent → do not resend, refer to previous images
- Vague address → request full details before confirming
- Customer hesitant → offer to reserve promotion, max 2-3 gentle attempts
- Customer declines clearly → stop selling, end professionally
- Short, friendly sentences with emoji for engagement
---
Output format:
- Short, friendly sentences (1-3 per message)
- Include emojis as in templates (😍, 🎉, ✅, 🎁, 💎)
- Embed image URLs exactly as provided
- Format order confirmations clearly with labels and emojis
- Use exact phrases for fallback like "As shown in customer photos above"
---
Stop conditions:
- Conversation ends after successful order confirmation
- Conversation ends if customer clearly declines after 2-3 attempts
- Conversation ends if customer stops responding
- Do not continue selling after order completion or clear refusal
---
--- End of structured prompt ---`;
}
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { imageBase64, images, mediaType, samplePitch, sampleBotcake, country, currency, priceCombo1, priceCombo2, langs } = body;
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
        const writerResult = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            max_tokens: 8000,
            temperature: 0.7,
            messages: [
                { role: "system", content: getWriterPrompt(samplePitch, sampleBotcake, currency, priceCombo1, priceCombo2, activeLangs) },
                {
                    role: "user",
                    content: `Thông tin sản phẩm:\n\n${productDescription}\n\nViết nội dung marketing đầy đủ tất cả ${sectionCount} sections. KHÔNG JSON, dùng ===SECTION=== markers.`,
                },
            ],
        });

        const rawText = writerResult.choices[0]?.message?.content || "";
        const p = parseSections(rawText);

        // ══════ Post-process: Wrap Botcake scripts into structured prompt ══════
        const botcakeViStructured = buildStructuredBotcake({
            chatbotScript: p.botcakeVi,
            productName: "sản phẩm",
            ingredients: p.ingredientsVi,
            usage: p.usageVi,
            lang: "vi",
        });
        const botcakeEnStructured = activeLangs.includes('en') ? buildStructuredBotcake({
            chatbotScript: p.botcakeEn,
            productName: "product",
            ingredients: p.ingredientsEn,
            usage: p.usageEn,
            lang: "en",
        }) : "";
        const botcakeIdStructured = activeLangs.includes('id') ? buildStructuredBotcake({
            chatbotScript: p.botcakeId || p.botcakeEn,
            productName: "produk",
            ingredients: p.ingredientsId || p.ingredientsEn,
            usage: p.usageId || p.usageEn,
            lang: "en",
        }) : "";

        return NextResponse.json({
            pitchVi: p.pitchVi,
            pitchEn: p.pitchEn,
            pitchPh: p.pitchPh,
            pitchId: p.pitchId,
            botcakeVi: botcakeViStructured,
            botcakeEn: botcakeEnStructured,
            botcakeId: botcakeIdStructured,
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
