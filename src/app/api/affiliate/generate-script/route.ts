import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

interface ScriptRequest {
  productName: string;
  price: string;
  salePrice?: string;
  usp: string[];          // Key selling points
  category: string;
  language: string;        // vi, en, ar
  duration: "15s" | "30s" | "60s";
}

/**
 * POST /api/affiliate/generate-script
 * 
 * Uses Groq (Llama) to generate affiliate video scripts in batch.
 * Body: { products: ScriptRequest[] }
 * Returns: { scripts: { productName, hook, problem, solution, proof, cta, fullText }[] }
 */
export async function POST(req: NextRequest) {
  try {
    const { products } = (await req.json()) as { products: ScriptRequest[] };

    if (!products || products.length === 0) {
      return NextResponse.json({ error: "No products provided" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 });
    }

    const groq = new Groq({ apiKey });
    const scripts: Record<string, unknown>[] = [];

    for (const product of products) {
      try {
        const langLabel = product.language === "vi" ? "tiếng Việt" : product.language === "ar" ? "tiếng Ả Rập" : "English";
        const durSeconds = parseInt(product.duration) || 30;

        const prompt = `Bạn là chuyên gia viết kịch bản video affiliate bán hàng trên TikTok/Reels. Hãy viết kịch bản video ${durSeconds} giây bằng ${langLabel} cho sản phẩm sau:

Tên sản phẩm: ${product.productName}
Giá gốc: ${product.price}
${product.salePrice ? `Giá sale: ${product.salePrice}` : ""}
Danh mục: ${product.category}
Điểm nổi bật:
${product.usp.map((u, i) => `${i + 1}. ${u}`).join("\n")}

Yêu cầu format JSON (KHÔNG markdown, KHÔNG code block):
{
  "hook": "Câu mở đầu gây tò mò, dừng scroll (3 giây)",
  "problem": "Vấn đề người xem đang gặp phải (5 giây)",
  "solution": "Sản phẩm giải quyết vấn đề thế nào (7 giây)",
  "proof": "Bằng chứng/social proof/số liệu (5 giây)",
  "cta": "Call-to-action cuối cùng (3 giây)",
  "fullText": "Toàn bộ nội dung voiceover ghép lại thành đoạn văn liền mạch"
}

Quy tắc:
- Hook phải CỰC kỳ hấp dẫn, gây tò mò ngay 3 giây đầu
- Ngôn ngữ tự nhiên, đời thường, dễ hiểu
- CTA rõ ràng: "Bấm link ở bio", "Thêm vào giỏ hàng ngay"
- fullText là đoạn văn liền mạch để đọc voiceover (KHÔNG có ký hiệu đặc biệt)
- Chỉ trả về JSON thuần, không bọc trong code block`;

        const completion = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.3-70b-versatile",
          temperature: 0.7,
          max_tokens: 1000,
          response_format: { type: "json_object" },
        });

        const content = completion.choices[0]?.message?.content || "{}";
        let parsed: Record<string, string>;

        try {
          parsed = JSON.parse(content);
        } catch {
          // Try to extract JSON from potential markdown wrapping
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        }

        scripts.push({
          productName: product.productName,
          hook: parsed.hook || "",
          problem: parsed.problem || "",
          solution: parsed.solution || "",
          proof: parsed.proof || "",
          cta: parsed.cta || "",
          fullText: parsed.fullText || "",
          language: product.language,
        });
      } catch (err) {
        scripts.push({
          productName: product.productName,
          error: err instanceof Error ? err.message : "Script generation failed",
        });
      }
    }

    return NextResponse.json({ scripts });
  } catch (err) {
    return NextResponse.json(
      { error: `Script generation error: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
