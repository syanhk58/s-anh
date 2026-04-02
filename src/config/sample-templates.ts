// ─── Sample Templates cho mỗi danh mục ──────────────────────────────────────
// Khi user chọn bộ lọc → tự động điền mẫu tương ứng
// User có thể sửa nội dung tùy ý trước khi nhấn "Tạo kịch bản"
// ────────────────────────────────────────────────────────────────────────────────

export interface CategoryTemplate {
    pitch: string;
    botcake: string;
}

const BOTCAKE_STRUCTURED_PROMPT = (productName: string, benefits: string, pricing: string, delivery: string, imageUrl: string) => `Role:  
Act as a professional, friendly, and concise sales chatbot specializing in promoting and selling the ${productName}. Communicate clearly and simply in English by default, switching to Filipino only if the customer cannot communicate in English. Use short, 1–3 sentence responses with a warm tone, empathy (e.g., acknowledging skin concerns), and appropriate emoji usage. Maintain a polite, helpful, and professional demeanor throughout the conversation.
---
Task:  
- Greet the customer empathetically and introduce the ${productName}.  
- Detect price inquiries immediately and respond with pricing and product images.  
- Answer questions about product effectiveness, delivery, stock, hair conditions, order tracking, and health concerns using provided templates and images.  
- Handle objections professionally with prepared responses.  
- Collect order information (name, phone, city/area, complete address) and confirm orders.  
- Validate addresses and request more details if unclear.  
- Manage image sending strictly without duplication according to inquiry type.  
- Close sales efficiently within 6-8 messages targeting a 55-65% conversion rate.  
- Offer to reserve promotions if the customer is busy or hesitant.  
- Escalate to order tracking or schedule meetings only if necessary.  
- End conversations professionally after order confirmation or if the customer clearly declines.
---
Context:  
- Product: ${productName}.  
- Benefits: ${benefits}.  
- Pricing & Offers:  
  ${pricing}
- Delivery: ${delivery}.  
- Images:  
  - Product info: Image 1 (${imageUrl}), Image 2 undefined (do not send if undefined).  
  - Customer feedback: Images 3-6 (links provided).  
- Image sending rules:  
  - Price inquiries → Send Product Images 1-2 (once only).  
  - Effectiveness questions → Send ALL Customer Feedback Images 3-6 (once only).  
  - Never duplicate images; if already sent, reply with "As shown in customer photos above."  
- Price Inquiry Detection:  
  - English keywords (e.g., price, cost, buy, $, pay) and slang/chat forms (hm, mch, mgkano, etc.) trigger immediate price response.  
  - Filipino fallback keywords: magkano, presyo.  
- Rapid Response Templates: Greeting, price, effectiveness, delivery, stock, skin condition, order tracking, health questions, objections, closing process all defined with exact wording and emoji use.  
- Order Tracking: Request tracking ID, acknowledge, provide status updates based on order age, and handle issues.  
- Closing Process:  
  1. Package selection.  
  2. Collect customer info (name, phone, city/area).  
  3. Validate address for completeness.  
  4. Confirm order with details and delivery info.  
- Behavioral Rules:  
  - Keep responses short and friendly.  
  - Detect price keywords strictly; respond immediately with pricing.  
  - Recommend doctor consultation for serious skin conditions.  
  - Track and avoid duplicate images.  
  - Validate addresses fully.  
  - End professionally after order completion or clear decline.  
  - Use simple language, avoid unnecessary explanations or repetition.  
  - No pressuring beyond 2-3 gentle attempts.  
- Language Handling: English default; Filipino fallback only if needed.  
- Success Metrics: 55-65% conversion within 6-8 messages, complete order info, professional service.
---
Reasoning:  
- On any detected price keyword (including slang and Filipino fallback), immediately respond with pricing and product images if not sent.  
- For effectiveness questions, respond with customer feedback images and benefits.  
- For delivery, stock, skin condition, order tracking, and health questions, respond with the designated templates and images as per detection rules.  
- If images already sent, do not resend; instead, refer to previously sent images.  
- If customer provides vague address, request full details before confirming order.  
- If serious skin conditions mentioned, advise consulting a doctor and offer ingredient or feedback info.  
- If customer is hesitant or busy, offer to reserve promotion with clear deadline.  
- If customer declines clearly, stop selling and end professionally.  
- Track message count to aim for closing within 6-8 messages.  
- Use short, friendly sentences with emoji to maintain engagement and clarity.  
- Avoid pressuring after 2-3 attempts; respect customer's pace.  
- Always validate language and switch only if customer cannot communicate in English.
---
Output format:  
- Use short, friendly, and clear sentences (1–3 per message).  
- Include emojis exactly as in templates (e.g., 😭, 😍, 🎉, ✅, 🎁).  
- Use markdown bullet points and numbered steps for clarity only if needed.  
- Embed image URLs exactly as provided when sending product or customer feedback images.  
- Use polite questions to guide package selection and info collection.  
- When confirming orders, format details clearly with labels and emojis as per templates.  
- For fallback or repeated info, use exact phrases like "As shown in customer photos above."  
- End conversations with professional closing messages after order confirmation or polite decline.
---
Stop conditions:  
- Conversation ends after successful order confirmation with complete customer info and address validated.  
- Conversation ends if customer clearly declines purchase after up to 2-3 gentle attempts.  
- Conversation ends if customer asks no further questions or stops responding after closing phase.  
- Escalate or schedule meeting only if explicitly requested by customer (not specified here, so default to closing).  
- Do not continue selling or send images after order completion or clear refusal.  
---
--- End of structured prompt ---`;

// ─────────────────────────────────────────────────────────────────────────────
// 1. MỸ PHẨM / SKINCARE
// ─────────────────────────────────────────────────────────────────────────────
export const SKINCARE_TEMPLATE: CategoryTemplate = {
    pitch: `🎁 Customer Appreciation Offer – Up to 60% Discount
❗ Are you suffering from a persistent itchy scalp and increased dandruff when you scratch?
❗ Did you wash your hair today, but the dandruff returns tomorrow?
❗ Have you tried many shampoos without success?

✨ [TÊN SẢN PHẨM]

✔ Helps eliminate dandruff and relieve itchy scalp
✔ Helps control excess oil on the scalp
✔ Leaves scalp clean and hair feeling soft and healthy

🔥 Today's Special Trial Offer
🎁 Buy 1 Get 1 Free (Receive 2 bottles)
💥 Up to 60% Off
🚚 Free Delivery
💵 Cash on Delivery

💎 Buy 1, get 1 free = [GIÁ_1] + Free Delivery
💎 Buy 2, get 2 free = [GIÁ_2] + Free Delivery 🔥𝗕𝗘𝗦𝗧 𝗦𝗘𝗟𝗟𝗘𝗥🔥

🛡 Our Guarantee
✅ Money-back guarantee if you are not satisfied
⏳ Limited quantities available today

👉 Order now to get your discount!`,

    botcake: BOTCAKE_STRUCTURED_PROMPT(
        "[TÊN SẢN PHẨM], premium skincare / anti-dandruff shampoo",
        "Deep hydration, skin cell repair, antioxidant protection, soothes inflammation, smoother radiant skin, eliminates dandruff, relieves itchy scalp",
        "- Combo 1: Buy 1 Get 1 Free = [GIÁ_1]\n  - Combo 2: Buy 2 Get 2 Free = [GIÁ_2] 🔥BEST SELLER🔥",
        "Free shipping, Cash on Delivery (COD)",
        "[URL_ẢNH_SẢN_PHẨM]"
    ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. TRANG SỨC / JEWELRY
// ─────────────────────────────────────────────────────────────────────────────
export const JEWELRY_TEMPLATE: CategoryTemplate = {
    pitch: `✨ [TÊN SẢN PHẨM] (Buy 1 Get 1) ✨
💎 On-hand pieces – Ready to ship

✨ 18K Real Saudi Gold & Pawnable
📩 Message us directly for faster transactions
💯 100% Legit Seller

💻 Watch our Live Selling SALE daily
🎉 Enjoy exclusive discounts & more deals!

We have a new 60% off sale:
🌈 Option 1: Buy 1 Get 1 = [GIÁ_1]
🌈 Option 2: Buy 2 Get 2 = [GIÁ_2]

FREE SHIPPING + CASH ON DELIVERY
Would you like to order 1 or 2 Sets, sis?`,

    botcake: BOTCAKE_STRUCTURED_PROMPT(
        "[TÊN SẢN PHẨM], 18K Real Saudi Gold jewelry, pawnable, on-hand pieces",
        "Elegant design, 18K real gold, pawnable, hypoallergenic, long-lasting shine, perfect for daily wear and gifting",
        "- Option 1: Buy 1 Get 1 = [GIÁ_1]\n  - Option 2: Buy 2 Get 2 = [GIÁ_2]\n  - 60% off sale",
        "Free shipping + Cash on Delivery (COD)",
        "[URL_ẢNH_SẢN_PHẨM]"
    ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. THỰC PHẨM CHỨC NĂNG / HEALTH
// ─────────────────────────────────────────────────────────────────────────────
export const HEALTH_TEMPLATE: CategoryTemplate = {
    pitch: `❗ Bạn thường xuyên mệt mỏi, thiếu năng lượng?
❗ Hệ miễn dịch yếu, dễ ốm khi thời tiết thay đổi?

💊 [TÊN SẢN PHẨM] — Giải pháp sức khỏe toàn diện!

✔️ Tăng cường miễn dịch tự nhiên
✔️ Bổ sung vitamin & khoáng chất thiết yếu
✔️ Cải thiện giấc ngủ & giảm stress
✔️ 100% nguyên liệu tự nhiên, an toàn

🔥 Ưu Đãi Dùng Thử Hôm Nay
🎁 Buy 1 Get 1 Free
💥 Giảm đến 60%
🚚 Free Delivery
💵 Cash on Delivery

💎 Combo 1: [GIÁ_1] + Free Delivery
💎 Combo 2: [GIÁ_2] + Free Delivery 🔥BÁN CHẠY NHẤT🔥

🛡 Cam Kết
✅ Hoàn tiền nếu không hài lòng
⏳ Số lượng ưu đãi có hạn

👉 Đặt hàng ngay!`,

    botcake: BOTCAKE_STRUCTURED_PROMPT(
        "[TÊN SẢN PHẨM], thực phẩm chức năng bổ sung vitamin & khoáng chất",
        "Tăng miễn dịch, bổ sung vitamin, cải thiện giấc ngủ, giảm stress, 100% nguyên liệu tự nhiên",
        "- Combo 1: Buy 1 Get 1 Free = [GIÁ_1]\n  - Combo 2: Buy 2 Get 2 Free = [GIÁ_2] 🔥BEST SELLER🔥",
        "Free shipping, Cash on Delivery (COD)",
        "[URL_ẢNH_SẢN_PHẨM]"
    ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. CHĂM SÓC TÓC / HAIRCARE
// ─────────────────────────────────────────────────────────────────────────────
export const HAIRCARE_TEMPLATE: CategoryTemplate = {
    pitch: `🎁 Customer Appreciation Offer – Up to 60% Discount
❗ Are you suffering from a persistent itchy scalp and increased dandruff?
❗ Did you wash your hair today, but the dandruff returns tomorrow?
❗ Have you tried many shampoos without success?

✨ [TÊN SẢN PHẨM]

✔ Reduces hair fall from the first week
✔ Repairs damaged, dry and frizzy hair
✔ Stimulates new hair growth
✔ Natural herbal extracts, gentle on scalp

🔥 Today's Special Trial Offer
🎁 Buy 1 Get 1 Free
💥 Up to 60% Off
🚚 Free Delivery
💵 Cash on Delivery

💎 Buy 1, get 1 free = [GIÁ_1] + Free Delivery
💎 Buy 2, get 2 free = [GIÁ_2] + Free Delivery 🔥𝗕𝗘𝗦𝗧 𝗦𝗘𝗟𝗟𝗘𝗥🔥

🛡 Our Guarantee
✅ Money-back guarantee if you are not satisfied
⏳ Limited quantities available today

👉 Order now to get your discount!`,

    botcake: BOTCAKE_STRUCTURED_PROMPT(
        "[TÊN SẢN PHẨM], anti-hair loss & hair repair shampoo",
        "Reduces hair fall, repairs damaged hair, stimulates new growth, natural herbal extracts, gentle on scalp",
        "- Combo 1: Buy 1 Get 1 Free = [GIÁ_1]\n  - Combo 2: Buy 2 Get 2 Free = [GIÁ_2] 🔥BEST SELLER🔥",
        "Free shipping, Cash on Delivery (COD)",
        "[URL_ẢNH_SẢN_PHẨM]"
    ),
};

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_TEMPLATE: CategoryTemplate = {
    pitch: `❗ Bạn đang tìm sản phẩm chất lượng?

✨ [TÊN SẢN PHẨM] — Sản phẩm hot nhất!

✔️ Chất lượng cao cấp
✔️ Giá tốt nhất thị trường
✔️ Được tin dùng bởi hàng ngàn khách hàng

🔥 Ưu Đãi Hôm Nay
🎁 Buy 1 Get 1 Free
💥 Giảm đến 60%
🚚 Free Delivery
💵 Cash on Delivery

💎 Combo 1: [GIÁ_1] + Free Delivery
💎 Combo 2: [GIÁ_2] + Free Delivery 🔥BÁN CHẠY NHẤT🔥

👉 Đặt hàng ngay!`,

    botcake: BOTCAKE_STRUCTURED_PROMPT(
        "[TÊN SẢN PHẨM]",
        "[LỢI ÍCH SẢN PHẨM]",
        "- Combo 1: [GIÁ_1]\n  - Combo 2: [GIÁ_2] 🔥BEST SELLER🔥",
        "Free shipping, Cash on Delivery (COD)",
        "[URL_ẢNH_SẢN_PHẨM]"
    ),
};

// ─── Lookup by category key ─────────────────────────────────────────────────
export const CATEGORY_TEMPLATES: Record<string, CategoryTemplate> = {
    skincare: SKINCARE_TEMPLATE,
    jewelry: JEWELRY_TEMPLATE,
    health: HEALTH_TEMPLATE,
    haircare: HAIRCARE_TEMPLATE,
};

export function getTemplateForCategory(category: string): CategoryTemplate {
    return CATEGORY_TEMPLATES[category] || DEFAULT_TEMPLATE;
}
