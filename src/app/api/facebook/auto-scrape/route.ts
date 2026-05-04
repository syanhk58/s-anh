import puppeteer, { type Page, type Browser } from "puppeteer";
import Groq from "groq-sdk";
import path from "path";

const CHROME_DATA_DIR = path.join(process.cwd(), ".chrome-data");

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((r) => setTimeout(r, ms));
}

async function checkLoggedIn(page: Page): Promise<boolean> {
  try {
    return !(await page.evaluate(() => !!document.querySelector('input[name="email"]')));
  } catch {
    return false;
  }
}

// ─── Extract posts + comments from a Facebook group page ──────────────────────
async function extractGroupContent(
  page: Page,
  maxPosts: number,
  keywords: string[],
  send: (d: Record<string, unknown>) => void,
  groupIndex: number
): Promise<string[]> {
  const scrollCount = Math.ceil(maxPosts / 4);

  for (let i = 0; i < scrollCount; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.8));
    await randomDelay(1500, 2500);

    // Click "Xem thêm" / "See more" to expand posts
    await page.evaluate(() => {
      document.querySelectorAll('div[role="button"], span[role="button"]').forEach((el) => {
        const t = (el as HTMLElement).textContent?.trim() || "";
        if (t === "Xem thêm" || t === "See more" || t === "See More") {
          (el as HTMLElement).click();
        }
      });
    });
    await randomDelay(300, 600);

    if (i % 3 === 2) {
      send({
        type: "step",
        index: groupIndex,
        message: `  → Đã scroll ${i + 1}/${scrollCount} lần...`,
      });
    }
  }

  // Expand comments sections
  send({ type: "step", index: groupIndex, message: `  → Mở rộng bình luận...` });
  await page.evaluate(() => {
    document.querySelectorAll('div[role="button"], span[role="button"], span').forEach((el) => {
      const t = (el as HTMLElement).textContent?.trim().toLowerCase() || "";
      if (
        t.includes("bình luận") ||
        t.includes("comment") ||
        t.includes("phản hồi") ||
        t.includes("replies") ||
        t.includes("xem thêm bình luận") ||
        t.includes("view more comment")
      ) {
        try {
          (el as HTMLElement).click();
        } catch {
          /* ignore */
        }
      }
    });
  });
  await randomDelay(1500, 2500);

  // Click "Xem thêm" again for expanded comments/posts
  await page.evaluate(() => {
    document.querySelectorAll('div[role="button"], span[role="button"]').forEach((el) => {
      const t = (el as HTMLElement).textContent?.trim() || "";
      if (t === "Xem thêm" || t === "See more") {
        (el as HTMLElement).click();
      }
    });
  });
  await randomDelay(500, 800);

  // Extract all text content from articles
  const contents = await page.evaluate(
    (maxP: number, kws: string[]) => {
      const articles = Array.from(document.querySelectorAll('div[role="article"]'));
      const results: string[] = [];
      const seen = new Set<string>();

      for (const article of articles.slice(0, maxP * 2)) {
        const textEls = article.querySelectorAll('div[dir="auto"], span[dir="auto"]');
        const parts: string[] = [];

        textEls.forEach((el) => {
          const text = (el as HTMLElement).innerText?.trim();
          if (
            text &&
            text.length > 3 &&
            !text.startsWith("http") &&
            !parts.includes(text)
          ) {
            parts.push(text);
          }
        });

        if (parts.length > 0) {
          const fullText = parts.join("\n").slice(0, 2000);
          const hash = fullText.slice(0, 80);
          if (seen.has(hash)) continue;
          seen.add(hash);

          if (kws.length > 0) {
            const lower = fullText.toLowerCase();
            const hasKw = kws.some((kw) => lower.includes(kw.toLowerCase().trim()));
            if (hasKw) results.push(fullText);
          } else {
            results.push(fullText);
          }
        }

        if (results.length >= maxP) break;
      }

      return results;
    },
    maxPosts,
    keywords
  );

  return contents;
}

// ─── Main POST handler ───────────────────────────────────────────────────────
export async function POST(req: Request) {
  const body = await req.json();
  const {
    groups,
    maxPosts = 20,
    keywords = [],
  } = body as {
    groups: { name: string; url: string }[];
    maxPosts: number;
    keywords: string[];
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* stream closed */
        }
      };

      let browser: Browser | null = null;

      try {
        send({ type: "status", message: "🚀 Đang mở trình duyệt..." });

        browser = await puppeteer.launch({
          headless: false,
          userDataDir: CHROME_DATA_DIR,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-blink-features=AutomationControlled",
            "--window-size=1280,900",
            "--lang=vi",
          ],
          defaultViewport: { width: 1280, height: 900 },
        });

        const page = await browser.newPage();
        await page.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, "webdriver", { get: () => false });
        });
        await page.setUserAgent(
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        );

        // Check login
        send({ type: "status", message: "🔍 Kiểm tra đăng nhập Facebook..." });
        await page.goto("https://www.facebook.com/", {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
        await randomDelay(2000, 3000);

        const loggedIn = await checkLoggedIn(page);
        if (!loggedIn) {
          send({
            type: "login_required",
            message: "🔐 Cần đăng nhập Facebook trong trình duyệt vừa mở...",
          });
          let ok = false;
          for (let a = 0; a < 90; a++) {
            await new Promise((r) => setTimeout(r, 2000));
            try {
              ok = await checkLoggedIn(page);
              if (ok) break;
            } catch {
              /* navigating */
            }
            if (a % 5 === 0)
              send({
                type: "waiting_login",
                message: `⏳ Đang chờ đăng nhập... (${a * 2}s)`,
              });
          }
          if (!ok) {
            send({ type: "error", message: "❌ Timeout đăng nhập." });
            await browser.close();
            controller.close();
            return;
          }
        }

        send({ type: "status", message: "✅ Đã đăng nhập Facebook!" });

        // Setup Groq AI
        const apiKey = process.env.GROQ_API_KEY;
        const groq = apiKey ? new Groq({ apiKey }) : null;

        let totalLeads = 0;
        let totalPosts = 0;

        for (let i = 0; i < groups.length; i++) {
          const group = groups[i];
          send({
            type: "scraping",
            index: i,
            total: groups.length,
            groupName: group.name,
            message: `📡 [${i + 1}/${groups.length}] Đang cào: ${group.name}`,
          });

          try {
            await page.goto(group.url, {
              waitUntil: "networkidle2",
              timeout: 30000,
            });
            await randomDelay(2000, 4000);

            send({
              type: "step",
              index: i,
              message: `  → Đang scroll và thu thập bài viết + bình luận...`,
            });

            const contents = await extractGroupContent(
              page,
              maxPosts,
              keywords,
              send,
              i
            );

            totalPosts += contents.length;
            send({
              type: "step",
              index: i,
              message: `  → 📝 Đã thu thập ${contents.length} nội dung`,
            });

            if (contents.length === 0) {
              send({
                type: "group_done",
                index: i,
                groupName: group.name,
                leads: [],
                postsScraped: 0,
                message: `⚠️ Không tìm thấy nội dung phù hợp ở: ${group.name}`,
              });
              continue;
            }

            // AI analysis in batches
            const batchSize = 8;
            const groupLeads: Array<{
              name: string;
              need: string;
              contact: string;
              category: string;
              confidence: string;
            }> = [];

            for (let b = 0; b < contents.length; b += batchSize) {
              const batch = contents.slice(b, b + batchSize);
              const batchNum = Math.floor(b / batchSize) + 1;
              const totalBatches = Math.ceil(contents.length / batchSize);
              const batchText = batch.join("\n\n---NEXT POST---\n\n");

              send({
                type: "step",
                index: i,
                message: `  → 🤖 AI phân tích batch ${batchNum}/${totalBatches}...`,
              });

              if (groq) {
                try {
                  const result = await groq.chat.completions.create({
                    model: "llama-3.3-70b-versatile",
                    max_tokens: 3000,
                    temperature: 0.3,
                    messages: [
                      {
                        role: "system",
                        content: `Bạn là chuyên gia phân tích khách hàng tiềm năng trên mạng xã hội.
Từ bài đăng/bình luận nhóm Facebook, trích xuất người có nhu cầu thật sự.
Trả về JSON: { "leads": [{ "name": "tên/profile", "need": "nhu cầu ngắn gọn", "contact": "SĐT/email/link FB", "category": "phân loại", "confidence": "high/medium/low" }] }
Chỉ lấy người thực sự có nhu cầu mua/thuê/tìm dịch vụ. Bỏ qua spam. JSON thuần, không markdown.`,
                      },
                      {
                        role: "user",
                        content: `Phân tích các bài viết/bình luận sau:\n\n${batchText}`,
                      },
                    ],
                  });

                  const raw = result.choices[0]?.message?.content || "{}";
                  const cleaned = raw
                    .replace(/```json\n?/g, "")
                    .replace(/```\n?/g, "")
                    .trim();
                  try {
                    const parsed = JSON.parse(cleaned);
                    if (parsed.leads && Array.isArray(parsed.leads)) {
                      groupLeads.push(...parsed.leads);
                      // Stream partial leads
                      send({
                        type: "leads_found",
                        index: i,
                        groupName: group.name,
                        newLeads: parsed.leads,
                        message: `  → ✨ Tìm thấy ${parsed.leads.length} leads mới (batch ${batchNum})`,
                      });
                    }
                  } catch {
                    /* ignore parse errors */
                  }
                } catch (aiErr: unknown) {
                  const msg = aiErr instanceof Error ? aiErr.message : "unknown";
                  send({
                    type: "step",
                    index: i,
                    message: `  → ⚠️ AI lỗi batch ${batchNum}: ${msg}`,
                  });
                }
              } else {
                send({
                  type: "step",
                  index: i,
                  message: `  → ⚠️ Không có GROQ_API_KEY, gửi raw text`,
                });
                // Return raw content as basic leads
                batch.forEach((text) => {
                  if (text.length > 20) {
                    groupLeads.push({
                      name: "",
                      need: text.slice(0, 200),
                      contact: "",
                      category: "Chưa phân loại",
                      confidence: "low",
                    });
                  }
                });
              }

              await randomDelay(300, 800);
            }

            totalLeads += groupLeads.length;

            send({
              type: "group_done",
              index: i,
              groupName: group.name,
              leads: groupLeads,
              postsScraped: contents.length,
              message: `✅ ${group.name}: ${contents.length} bài → ${groupLeads.length} leads`,
            });

            // Delay between groups
            if (i < groups.length - 1) {
              const d = 3 + Math.random() * 4;
              send({
                type: "delay",
                message: `⏳ Chờ ${Math.round(d)}s trước nhóm tiếp...`,
              });
              await new Promise((r) => setTimeout(r, d * 1000));
            }
          } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            send({
              type: "group_error",
              index: i,
              groupName: group.name,
              message: `❌ Lỗi nhóm ${group.name}: ${errorMsg}`,
            });
          }
        }

        send({
          type: "complete",
          totalLeads,
          totalPosts,
          message: `🎉 Hoàn thành! ${totalPosts} bài → ${totalLeads} leads từ ${groups.length} nhóm`,
        });

        await randomDelay(2000, 3000);
        await browser.close();
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        send({ type: "error", message: `❌ Lỗi hệ thống: ${errorMsg}` });
        if (browser) {
          try {
            await browser.close();
          } catch {
            /* ignore */
          }
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
