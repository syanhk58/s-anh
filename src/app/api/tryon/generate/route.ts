import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * POST /api/tryon/generate
 * Virtual Try-On using HuggingFace Spaces Gradio API (v4+ format)
 */

const SPACES = [
  {
    id: "Kwai-Kolors/Kolors-Virtual-Try-On",
    url: "https://kwai-kolors-kolors-virtual-try-on.hf.space",
    apiName: "tryon",
  },
  {
    id: "yisol/IDM-VTON",
    url: "https://yisol-idm-vton.hf.space",
    apiName: "tryon",
  },
];

async function trySpace(
  space: typeof SPACES[0],
  personBase64: string,
  garmentBase64: string
): Promise<string | null> {
  const baseUrl = space.url;

  // --- Attempt 1: Gradio 4+ /call/ API ---
  try {
    console.log(`[TryOn] Trying ${space.id} via /call/ API...`);

    // Step 1: Submit job
    const submitRes = await fetch(`${baseUrl}/call/${space.apiName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          { path: personBase64, meta: { _type: "gradio.FileData" } },
          { path: garmentBase64, meta: { _type: "gradio.FileData" } },
        ],
      }),
    });

    if (submitRes.ok) {
      const { event_id } = await submitRes.json();
      if (event_id) {
        // Step 2: Poll SSE for result
        const result = await pollResult(`${baseUrl}/call/${space.apiName}/${event_id}`);
        if (result) return result;
      }
    }
  } catch (e) {
    console.log(`[TryOn] /call/ API failed for ${space.id}:`, e);
  }

  // --- Attempt 2: Gradio /api/predict ---
  try {
    console.log(`[TryOn] Trying ${space.id} via /api/predict...`);

    // Upload files first
    const personPath = await uploadFile(baseUrl, personBase64, "person.png");
    const garmentPath = await uploadFile(baseUrl, garmentBase64, "garment.png");

    if (!personPath || !garmentPath) {
      console.log(`[TryOn] Upload failed for ${space.id}`);
      return null;
    }

    const predictRes = await fetch(`${baseUrl}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          { path: personPath, meta: { _type: "gradio.FileData" } },
          { path: garmentPath, meta: { _type: "gradio.FileData" } },
        ],
        fn_index: 0,
        session_hash: `s_${Date.now()}`,
      }),
    });

    if (predictRes.ok) {
      const result = await predictRes.json();
      return extractImageFromResult(baseUrl, result);
    }
  } catch (e) {
    console.log(`[TryOn] /api/predict failed for ${space.id}:`, e);
  }

  // --- Attempt 3: Queue-based API ---
  try {
    console.log(`[TryOn] Trying ${space.id} via /queue/join...`);

    const personPath = await uploadFile(baseUrl, personBase64, "person.png");
    const garmentPath = await uploadFile(baseUrl, garmentBase64, "garment.png");

    if (!personPath || !garmentPath) return null;

    const sessionHash = `s_${Date.now()}`;

    const joinRes = await fetch(`${baseUrl}/queue/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          { path: personPath, meta: { _type: "gradio.FileData" } },
          { path: garmentPath, meta: { _type: "gradio.FileData" } },
        ],
        fn_index: 0,
        session_hash: sessionHash,
      }),
    });

    if (joinRes.ok) {
      // Poll queue/data for result
      const maxWait = 90_000;
      const start = Date.now();

      while (Date.now() - start < maxWait) {
        await sleep(3000);

        const dataRes = await fetch(`${baseUrl}/queue/data?session_hash=${sessionHash}`, {
          headers: { Accept: "text/event-stream" },
        });

        if (dataRes.ok) {
          const text = await dataRes.text();
          // Parse SSE events
          const lines = text.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const evt = JSON.parse(line.slice(6));
                if (evt.msg === "process_completed" && evt.output?.data) {
                  return extractImageFromResult(baseUrl, evt.output);
                }
              } catch { /* continue */ }
            }
          }
        }
      }
    }
  } catch (e) {
    console.log(`[TryOn] /queue/join failed for ${space.id}:`, e);
  }

  return null;
}

async function uploadFile(baseUrl: string, base64Data: string, filename: string): Promise<string | null> {
  try {
    // Convert base64 to buffer
    const raw = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(raw, "base64");
    const blob = new Blob([buffer], { type: "image/png" });

    const form = new FormData();
    form.append("files", blob, filename);

    const res = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      body: form,
    });

    if (!res.ok) return null;

    const files = await res.json();
    // Response can be string[] or string
    if (Array.isArray(files)) return files[0];
    if (typeof files === "string") return files;
    return null;
  } catch {
    return null;
  }
}

async function pollResult(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "text/event-stream" },
    });

    if (!res.ok) return null;

    const text = await res.text();
    const lines = text.split("\n");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          // Result data is usually in data array
          if (Array.isArray(data) && data.length > 0) {
            const item = data[0];
            if (typeof item === "string" && item.startsWith("http")) {
              return await downloadAsBase64(item);
            }
            if (item?.url) {
              return await downloadAsBase64(item.url);
            }
          }
        } catch { /* continue */ }
      }
    }
  } catch { /* ignore */ }
  return null;
}

function extractImageFromResult(baseUrl: string, result: Record<string, unknown>): string | null {
  try {
    const data = (result as { data?: unknown[] }).data;
    if (!data || !Array.isArray(data) || data.length === 0) return null;

    const item = data[0];
    if (!item) return null;

    // Could be string URL, or object with url/path
    let url: string | null = null;

    if (typeof item === "string") {
      url = item;
    } else if (typeof item === "object" && item !== null) {
      const obj = item as Record<string, unknown>;
      url = (obj.url || obj.path || obj.value) as string | null;
    }

    if (!url) return null;

    // Make absolute URL
    if (!url.startsWith("http")) {
      if (url.startsWith("/")) {
        url = `${baseUrl}${url}`;
      } else {
        url = `${baseUrl}/file=${url}`;
      }
    }

    // Don't download here, return URL for client
    return url;
  } catch {
    return null;
  }
}

async function downloadAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
  try {
    const { personImage, garmentImage } = await req.json();

    if (!personImage || !garmentImage) {
      return NextResponse.json(
        { error: "Cần upload cả ảnh model và ảnh trang phục" },
        { status: 400 }
      );
    }

    // Try each space
    for (const space of SPACES) {
      console.log(`[TryOn] === Trying space: ${space.id} ===`);

      const result = await trySpace(space, personImage, garmentImage);

      if (result) {
        // If result is URL, download to base64
        let finalImage = result;
        if (result.startsWith("http")) {
          const downloaded = await downloadAsBase64(result);
          if (downloaded) finalImage = downloaded;
        }

        return NextResponse.json({
          success: true,
          resultImage: finalImage,
          model: space.id,
        });
      }
    }

    // All spaces failed - return helpful error
    return NextResponse.json(
      {
        error: "Các AI model đang quá tải hoặc bảo trì. Vui lòng thử lại sau 2-3 phút.",
        suggestion: "Bạn có thể thử tại: https://huggingface.co/spaces/Kwai-Kolors/Kolors-Virtual-Try-On"
      },
      { status: 503 }
    );
  } catch (err) {
    console.error("[TryOn] Fatal error:", err);
    return NextResponse.json(
      { error: `Lỗi server: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
