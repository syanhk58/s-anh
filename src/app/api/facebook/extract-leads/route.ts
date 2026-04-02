import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export async function POST(req: NextRequest) {
  try {
    const { rawText } = await req.json();
    if (!rawText?.trim()) return NextResponse.json({ error: "Thiếu nội dung" }, { status: 400 });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Chưa cấu hình GROQ_API_KEY" }, { status: 500 });

    const groq = new Groq({ apiKey });
    const result = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 3000,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `Bạn là chuyên gia phân tích khách hàng tiềm năng trên mạng xã hội.
Từ nội dung bài đăng / bình luận trong nhóm Facebook, hãy trích xuất thông tin khách hàng tiềm năng.
Trả về JSON hợp lệ với format:
{
  "leads": [
    {
      "name": "tên người hoặc profile (nếu không có thì để rỗng)",
      "need": "mô tả nhu cầu của họ ngắn gọn",
      "contact": "SĐT, email, link Facebook, Zalo nếu có (để rỗng nếu không có)",
      "category": "phân loại nhu cầu (ví dụ: Cần thiết kế web, Tìm supplier, Cần marketing...)",
      "confidence": "high/medium/low (high nếu rõ ràng có nhu cầu và liên hệ)"
    }
  ]
}
Chỉ trích xuất người thực sự có nhu cầu mua/thuê dịch vụ/tìm kiếm gì đó. Bỏ qua spam, quảng cáo thuần.
Trả về JSON thuần, không markdown, không giải thích.`
        },
        {
          role: "user",
          content: `Phân tích và trích xuất khách hàng tiềm năng từ nội dung này:\n\n${rawText}`
        }
      ]
    });

    const raw = result.choices[0]?.message?.content || "{}";
    // Clean up potential markdown code blocks
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    try {
      const parsed = JSON.parse(cleaned);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ leads: [], error: "Không parse được kết quả AI" });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
