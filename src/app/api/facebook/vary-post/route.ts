import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json();
    if (!content?.trim()) return NextResponse.json({ error: "Thiếu nội dung" }, { status: 400 });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Chưa cấu hình GROQ_API_KEY" }, { status: 500 });

    const groq = new Groq({ apiKey });
    const result = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 2000,
      temperature: 0.85,
      messages: [
        {
          role: "system",
          content: `Bạn là copywriter chuyên viết nội dung mạng xã hội.
Nhiệm vụ: Tạo ĐÚNG 3 biến thể của bài đăng Facebook, mỗi biến thể giữ nguyên ý nghĩa nhưng thay đổi cách diễn đạt, cấu trúc câu, emoji.
Format trả về ĐÚNG như sau (không giải thích thêm):
===VARIATION_1===
[nội dung biến thể 1]
===VARIATION_2===
[nội dung biến thể 2]
===VARIATION_3===
[nội dung biến thể 3]`
        },
        {
          role: "user",
          content: `Tạo 3 biến thể cho bài đăng này:\n\n${content}`
        }
      ]
    });

    const raw = result.choices[0]?.message?.content || "";
    const variations: string[] = [];
    const markers = ["===VARIATION_1===", "===VARIATION_2===", "===VARIATION_3==="];

    const positions = markers.map(m => ({ marker: m, idx: raw.indexOf(m) })).filter(p => p.idx !== -1).sort((a, b) => a.idx - b.idx);

    for (let i = 0; i < positions.length; i++) {
      const start = positions[i].idx + positions[i].marker.length;
      const end = i + 1 < positions.length ? positions[i + 1].idx : raw.length;
      const text = raw.substring(start, end).trim();
      if (text) variations.push(text);
    }

    if (variations.length === 0) {
      // fallback: split by double newline
      const parts = raw.split(/\n{3,}/).map((p: string) => p.trim()).filter((p: string) => p.length > 20);
      variations.push(...parts.slice(0, 3));
    }

    return NextResponse.json({ variations: variations.length > 0 ? variations : [content] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
