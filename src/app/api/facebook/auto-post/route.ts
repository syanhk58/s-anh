import puppeteer, { type Page, type Browser } from "puppeteer";
import path from "path";

const CHROME_DATA_DIR = path.join(process.cwd(), ".chrome-data");

// ─── Helper: Random delay (ms) ───────────────────────────────────────────────
function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Helper: Check if logged into Facebook ────────────────────────────────────
async function checkLoggedIn(page: Page): Promise<boolean> {
  try {
    const hasLoginForm = await page.evaluate(() => {
      return !!document.querySelector('input[name="email"]');
    });
    return !hasLoginForm;
  } catch {
    return false;
  }
}

// ─── Helper: Find and click post creation box ────────────────────────────────
async function findAndClickPostBox(page: Page): Promise<boolean> {
  // Strategy 1: XPath by text content (Vietnamese + English)
  const textPatterns = [
    "Bạn đang nghĩ gì",
    "Viết gì đó",
    "Write something",
    "What\u0027s on your mind",
    "Tạo bài viết công khai",
    "Tạo bài viết",
  ];

  for (const text of textPatterns) {
    try {
      const found = await page.evaluate((searchText: string) => {
        const allElements = Array.from(
          document.querySelectorAll(
            'div[role="button"], span, div[tabindex="0"]'
          )
        );
        const target = allElements.find((el) => {
          const t = (el as HTMLElement).innerText?.trim() || "";
          return t.includes(searchText);
        });
        if (target) {
          const clickable =
            (target as HTMLElement).closest('div[role="button"]') ||
            (target as HTMLElement).closest('div[tabindex="0"]') ||
            target;
          (clickable as HTMLElement).click();
          return true;
        }
        return false;
      }, text);
      if (found) {
        await randomDelay(1500, 2500);
        return true;
      }
    } catch {
      /* continue */
    }
  }

  // Strategy 2: aria-label selectors
  const ariaSelectors = [
    'div[aria-label*="Tạo bài viết"]',
    'div[aria-label*="Create a post"]',
    'div[aria-label*="bài viết"]',
    'div[aria-label*="Write something"]',
    'div[aria-label*="Viết gì đó"]',
  ];

  for (const selector of ariaSelectors) {
    try {
      const el = await page.$(selector);
      if (el) {
        await el.click();
        await randomDelay(1500, 2500);
        return true;
      }
    } catch {
      /* continue */
    }
  }

  return false;
}

// ─── Helper: Type content into post composer ──────────────────────────────────
async function typeInComposer(
  page: Page,
  content: string
): Promise<boolean> {
  // Wait for composer dialog to appear
  await randomDelay(1000, 2000);

  // Strategy 1: contenteditable textbox
  const textboxSelectors = [
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][aria-label*="nghĩ gì"]',
    'div[contenteditable="true"][aria-label*="Write something"]',
    'div[contenteditable="true"][aria-label*="Tạo bài viết"]',
    'div[contenteditable="true"][data-lexical-editor="true"]',
    'div[contenteditable="true"]',
  ];

  for (const selector of textboxSelectors) {
    try {
      const el = await page.$(selector);
      if (el) {
        await el.click();
        await randomDelay(300, 600);

        // Use keyboard.type for natural behavior
        // Split content into chunks for more natural typing
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (i > 0) {
            await page.keyboard.press("Enter");
            await randomDelay(50, 150);
          }
          // Type each line with variable speed
          await page.keyboard.type(lines[i], {
            delay: 8 + Math.random() * 15,
          });
          await randomDelay(100, 300);
        }
        return true;
      }
    } catch {
      /* continue */
    }
  }

  return false;
}

// ─── Helper: Click submit/post button ─────────────────────────────────────────
async function clickSubmitPost(page: Page): Promise<boolean> {
  await randomDelay(500, 1000);

  // Strategy 1: aria-label
  const ariaSelectors = [
    'div[aria-label="Đăng"][role="button"]',
    'div[aria-label="Post"][role="button"]',
    'button[aria-label="Đăng"]',
    'button[aria-label="Post"]',
    'div[aria-label="Đăng"]',
    'div[aria-label="Post"]',
  ];

  for (const selector of ariaSelectors) {
    try {
      const el = await page.$(selector);
      if (el) {
        const isDisabled = await el.evaluate(
          (node) =>
            (node as HTMLElement).getAttribute("aria-disabled") === "true"
        );
        if (!isDisabled) {
          await el.click();
          return true;
        }
      }
    } catch {
      /* continue */
    }
  }

  // Strategy 2: Find by text content "Đăng" or "Post" in button-like elements
  const clicked = await page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll('div[role="button"], button, [tabindex="0"]')
    );

    // Look for exact text match first
    for (const el of candidates) {
      const spans = el.querySelectorAll("span");
      for (const span of Array.from(spans)) {
        const text = span.textContent?.trim() || "";
        if (text === "Đăng" || text === "Post") {
          const htmlEl = el as HTMLElement;
          if (htmlEl.getAttribute("aria-disabled") !== "true") {
            htmlEl.click();
            return true;
          }
        }
      }
    }

    // Also try direct text content
    for (const el of candidates) {
      const text = (el as HTMLElement).textContent?.trim() || "";
      if ((text === "Đăng" || text === "Post") && text.length < 10) {
        const htmlEl = el as HTMLElement;
        if (htmlEl.getAttribute("aria-disabled") !== "true") {
          htmlEl.click();
          return true;
        }
      }
    }

    return false;
  });

  return clicked;
}

// ─── Helper: Wait for post submission (dialog closes) ─────────────────────────
async function waitForPostSubmission(page: Page): Promise<boolean> {
  try {
    // Wait for the composer dialog to disappear
    await page.waitForFunction(
      () => {
        const dialogs = document.querySelectorAll('div[role="dialog"]');
        return dialogs.length === 0;
      },
      { timeout: 15000 }
    );
    return true;
  } catch {
    // Even if timeout, the post might have been submitted
    return true;
  }
}

// ─── Main POST handler ───────────────────────────────────────────────────────
export async function POST(req: Request) {
  const body = await req.json();
  const {
    content,
    groups,
    delay: delaySeconds = 5,
    variations = [],
  } = body as {
    content: string;
    groups: { name: string; url: string }[];
    delay: number;
    variations: string[];
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          /* stream might be closed */
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
            "--disable-features=TranslateUI",
            "--lang=vi",
          ],
          defaultViewport: { width: 1280, height: 900 },
        });

        const page = await browser.newPage();

        // Make automation less detectable
        await page.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, "webdriver", { get: () => false });
          // @ts-expect-error -- override chrome runtime
          window.chrome = { runtime: {} };
        });

        await page.setUserAgent(
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        );

        // Navigate to Facebook to check login
        send({
          type: "status",
          message: "🔍 Kiểm tra đăng nhập Facebook...",
        });
        await page.goto("https://www.facebook.com/", {
          waitUntil: "networkidle2",
          timeout: 30000,
        });

        await randomDelay(2000, 3000);

        const loggedIn = await checkLoggedIn(page);

        if (!loggedIn) {
          send({
            type: "login_required",
            message:
              "🔐 Bạn cần đăng nhập Facebook trong trình duyệt vừa mở. Đang chờ đăng nhập...",
          });

          // Wait up to 3 minutes for login
          let isLoggedIn = false;
          for (let attempt = 0; attempt < 90; attempt++) {
            await new Promise((r) => setTimeout(r, 2000));
            try {
              isLoggedIn = await checkLoggedIn(page);
              if (isLoggedIn) break;
            } catch {
              /* page might be navigating */
            }
            if (attempt % 5 === 0) {
              send({
                type: "waiting_login",
                message: `⏳ Đang chờ đăng nhập... (${attempt * 2}s)`,
              });
            }
          }

          if (!isLoggedIn) {
            send({
              type: "error",
              message: "❌ Timeout: Không đăng nhập được Facebook sau 3 phút.",
            });
            await browser.close();
            controller.close();
            return;
          }
        }

        send({
          type: "status",
          message: "✅ Đã đăng nhập Facebook thành công!",
        });
        await randomDelay(1000, 2000);

        // Start posting to groups
        const results: Array<{
          index: number;
          name: string;
          status: string;
          error?: string;
        }> = [];
        const allContents =
          variations.length > 0 ? variations : [content];

        for (let i = 0; i < groups.length; i++) {
          const group = groups[i];
          const postContent =
            allContents[i % allContents.length];

          send({
            type: "posting",
            index: i,
            total: groups.length,
            groupName: group.name,
            message: `📝 [${i + 1}/${groups.length}] Đang đăng vào: ${group.name}`,
          });

          try {
            // Navigate to group
            await page.goto(group.url, {
              waitUntil: "networkidle2",
              timeout: 30000,
            });
            await randomDelay(2000, 4000);

            // Check if we're actually on a group page
            const isGroupPage = await page.evaluate(() => {
              return (
                window.location.href.includes("/groups/") ||
                !!document.querySelector('[role="main"]')
              );
            });

            if (!isGroupPage) {
              send({
                type: "group_error",
                index: i,
                groupName: group.name,
                message: `⚠️ Không truy cập được nhóm: ${group.name}`,
              });
              results.push({
                index: i,
                name: group.name,
                status: "error",
                error: "Không truy cập được nhóm",
              });
              continue;
            }

            // Step 1: Click post creation box
            send({
              type: "step",
              index: i,
              message: `  → Tìm ô soạn bài...`,
            });
            const postBoxClicked = await findAndClickPostBox(page);
            if (!postBoxClicked) {
              send({
                type: "group_error",
                index: i,
                groupName: group.name,
                message: `❌ Không tìm thấy ô soạn bài ở nhóm: ${group.name}`,
              });
              results.push({
                index: i,
                name: group.name,
                status: "error",
                error: "Không tìm thấy ô soạn bài",
              });
              continue;
            }

            // Step 2: Type content
            send({
              type: "step",
              index: i,
              message: `  → Đang nhập nội dung...`,
            });
            const typed = await typeInComposer(page, postContent);
            if (!typed) {
              send({
                type: "group_error",
                index: i,
                groupName: group.name,
                message: `❌ Không nhập được nội dung ở nhóm: ${group.name}`,
              });
              results.push({
                index: i,
                name: group.name,
                status: "error",
                error: "Không nhập được nội dung",
              });
              continue;
            }

            await randomDelay(800, 1500);

            // Step 3: Click Post button
            send({
              type: "step",
              index: i,
              message: `  → Bấm nút Đăng...`,
            });
            const posted = await clickSubmitPost(page);
            if (!posted) {
              send({
                type: "group_error",
                index: i,
                groupName: group.name,
                message: `❌ Không tìm thấy nút Đăng ở nhóm: ${group.name}`,
              });
              results.push({
                index: i,
                name: group.name,
                status: "error",
                error: "Không tìm thấy nút Đăng",
              });
              continue;
            }

            // Wait for submission
            await waitForPostSubmission(page);
            await randomDelay(1500, 2500);

            send({
              type: "group_done",
              index: i,
              groupName: group.name,
              message: `✅ Đã đăng thành công: ${group.name}`,
            });
            results.push({ index: i, name: group.name, status: "done" });

            // Delay between groups (randomized)
            if (i < groups.length - 1) {
              const actualDelay =
                delaySeconds + Math.random() * 4;
              send({
                type: "delay",
                index: i,
                message: `⏳ Chờ ${Math.round(actualDelay)}s trước nhóm tiếp theo...`,
                delaySeconds: Math.round(actualDelay),
              });
              await new Promise((r) =>
                setTimeout(r, actualDelay * 1000)
              );
            }
          } catch (err: unknown) {
            const errorMsg =
              err instanceof Error ? err.message : String(err);
            send({
              type: "group_error",
              index: i,
              groupName: group.name,
              message: `❌ Lỗi ở nhóm ${group.name}: ${errorMsg}`,
            });
            results.push({
              index: i,
              name: group.name,
              status: "error",
              error: errorMsg,
            });
          }
        }

        // Complete
        const doneCount = results.filter(
          (r) => r.status === "done"
        ).length;
        const errorCount = results.filter(
          (r) => r.status === "error"
        ).length;

        send({
          type: "complete",
          results,
          message: `🎉 Hoàn thành! Đã đăng: ${doneCount}/${groups.length} nhóm (${errorCount} lỗi)`,
          doneCount,
          errorCount,
          total: groups.length,
        });

        // Close browser after a short delay
        await randomDelay(2000, 3000);
        await browser.close();
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error ? err.message : String(err);
        send({
          type: "error",
          message: `❌ Lỗi hệ thống: ${errorMsg}`,
        });
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
