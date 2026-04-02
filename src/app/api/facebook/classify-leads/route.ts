import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

interface Category {
  label: string;
  keywords: string;
}

export async function POST(req: NextRequest) {
  try {
    const { text, categories }: { text: string; categories: Category[] } = await req.json();
    if (!text?.trim()) return NextResponse.json({ error: "Thiếu nội dung" }, { status: 400 });

    const lines = text.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 5);
    if (lines.length === 0) return NextResponse.json({ results: [] });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      // Fallback: simple keyword matching
      const results = lines.map((line: string) => {
        let bestMatch = { label: "Không xác định", score: 0 };
        categories.forEach(cat => {
          const kwList = cat.keywords.split(",").map((kw: string) => kw.trim().toLowerCase());
          const matches = kwList.filter((kw: string) => line.toLowerCase().includes(kw)).length;
          if (matches > bestMatch.score) bestMatch = { label: cat.label, score: matches };
        });
        return { text: line, matchedLabel: bestMatch.label, score: bestMatch.score };
      });
      return NextResponse.json({ results });
    }

    const groq = new Groq({ apiKey });

    const categoriesDesc = categories.map(c => `- "${c.label}": ${c.keywords}`).join("\n");

    const result = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 3000,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `Bạn là chuyên gia phân loại nhu cầu khách hàng.
Phân loại từng dòng text theo các danh mục sau:
${categoriesDesc}
- "Không xác định": nếu không khớp danh mục nào

Trả về JSON:
{
  "results": [
    { "text": "nội dung gốc", "matchedLabel": "tên danh mục", "score": 1-10 }
  ]
}
score từ 1-10 thể hiện độ khớp. Trả về JSON thuần, không markdown.`
        },
        {
          role: "user",
          content: `Phân loại ${lines.length} dòng sau:\n${lines.map((l: string, i: number) => `${i + 1}. ${l}`).join("\n")}`
        }
      ]
    });

    const raw = result.choices[0]?.message?.content || "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    try {
      const parsed = JSON.parse(cleaned);
      return NextResponse.json(parsed);
    } catch {
      // Fallback if parse fails
      const results = lines.map((line: string) => ({ text: line, matchedLabel: "Không xác định", score: 0 }));
      return NextResponse.json({ results });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
