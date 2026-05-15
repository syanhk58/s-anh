import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120; // 2 minutes for AI processing
export const dynamic = "force-dynamic";

/**
 * POST /api/tryon/generate
 * 
 * Virtual Try-On using HuggingFace Spaces Gradio API.
 * Model: Kwai-Kolors/Kolors-Virtual-Try-On (or fallback)
 * 
 * Body: { personImage: string (base64), garmentImage: string (base64) }
 * Returns: { resultImage: string (base64), success: boolean }
 */

const TRYON_SPACES = [
  "Kwai-Kolors/Kolors-Virtual-Try-On",
  "yisol/IDM-VTON",
];

async function callGradioSpace(
  spaceId: string,
  personBlob: Blob,
  garmentBlob: Blob
): Promise<string | null> {
  try {
    // Step 1: Get Space info and session
    const infoRes = await fetch(`https://${spaceId.replace("/", "-").toLowerCase()}.hf.space/info`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!infoRes.ok) {
      // Try alternate URL format
      const altInfoRes = await fetch(`https://huggingface.co/api/spaces/${spaceId}`);
      if (!altInfoRes.ok) throw new Error(`Space ${spaceId} not accessible`);
    }

    // Step 2: Upload files to the Space
    const baseUrl = `https://${spaceId.replace("/", "-").toLowerCase()}.hf.space`;

    // Upload person image
    const personForm = new FormData();
    personForm.append("files", personBlob, "person.png");
    const personUpRes = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      body: personForm,
    });
    if (!personUpRes.ok) throw new Error("Failed to upload person image");
    const personFiles = await personUpRes.json();
    const personPath = Array.isArray(personFiles) ? personFiles[0] : personFiles;

    // Upload garment image
    const garmentForm = new FormData();
    garmentForm.append("files", garmentBlob, "garment.png");
    const garmentUpRes = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      body: garmentForm,
    });
    if (!garmentUpRes.ok) throw new Error("Failed to upload garment image");
    const garmentFiles = await garmentUpRes.json();
    const garmentPath = Array.isArray(garmentFiles) ? garmentFiles[0] : garmentFiles;

    // Step 3: Call prediction API
    const predictPayload = {
      data: [
        { path: personPath, meta: { _type: "gradio.FileData" } },
        { path: garmentPath, meta: { _type: "gradio.FileData" } },
      ],
      fn_index: 0,
      session_hash: `session_${Date.now()}`,
    };

    // Try queue-based API first
    const queueRes = await fetch(`${baseUrl}/queue/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(predictPayload),
    });

    if (queueRes.ok) {
      const queueData = await queueRes.json();
      const eventId = queueData.event_id || queueData.hash;

      // Poll for result
      const maxWait = 90_000; // 90 seconds
      const startTime = Date.now();

      while (Date.now() - startTime < maxWait) {
        await new Promise(r => setTimeout(r, 3000));

        try {
          const statusRes = await fetch(`${baseUrl}/queue/status/${eventId}`);
          if (statusRes.ok) {
            const status = await statusRes.json();
            if (status.status === "COMPLETE" && status.data?.data) {
              const resultData = status.data.data[0];
              const resultUrl = typeof resultData === "string"
                ? resultData
                : resultData?.url || resultData?.path;

              if (resultUrl) {
                // Download result image
                const fullUrl = resultUrl.startsWith("http") ? resultUrl : `${baseUrl}/file=${resultUrl}`;
                const imgRes = await fetch(fullUrl);
                if (imgRes.ok) {
                  const buffer = Buffer.from(await imgRes.arrayBuffer());
                  return `data:image/png;base64,${buffer.toString("base64")}`;
                }
              }
            }
            if (status.status === "FAILED") throw new Error("Generation failed");
          }
        } catch {
          // Continue polling
        }
      }
      throw new Error("Timeout waiting for result");
    }

    // Fallback: direct predict API
    const predictRes = await fetch(`${baseUrl}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(predictPayload),
    });

    if (predictRes.ok) {
      const result = await predictRes.json();
      const resultData = result.data?.[0];
      const resultUrl = typeof resultData === "string"
        ? resultData
        : resultData?.url || resultData?.path;

      if (resultUrl) {
        const fullUrl = resultUrl.startsWith("http") ? resultUrl : `${baseUrl}/file=${resultUrl}`;
        const imgRes = await fetch(fullUrl);
        if (imgRes.ok) {
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          return `data:image/png;base64,${buffer.toString("base64")}`;
        }
      }
    }

    return null;
  } catch (err) {
    console.error(`Gradio Space ${spaceId} error:`, err);
    return null;
  }
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

    // Convert base64 to Blob
    const toBlob = (dataUrl: string): Blob => {
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      const mimeMatch = dataUrl.match(/^data:(image\/\w+);base64,/);
      const mime = mimeMatch ? mimeMatch[1] : "image/png";
      return new Blob([buffer], { type: mime });
    };

    const personBlob = toBlob(personImage);
    const garmentBlob = toBlob(garmentImage);

    // Try each Space until one works
    for (const spaceId of TRYON_SPACES) {
      console.log(`Trying Virtual Try-On space: ${spaceId}`);
      const result = await callGradioSpace(spaceId, personBlob, garmentBlob);
      if (result) {
        return NextResponse.json({
          success: true,
          resultImage: result,
          model: spaceId,
        });
      }
    }

    return NextResponse.json(
      { error: "Tất cả AI model đều đang bận. Vui lòng thử lại sau 1-2 phút." },
      { status: 503 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Lỗi: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
