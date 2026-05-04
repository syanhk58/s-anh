import { NextRequest } from "next/server";
import { generateVideo, type VideoTextSlide, type VideoGenSettings } from "@/lib/video-pipeline";

export const maxDuration = 300; // 5 minutes max for video generation
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    images,       // Array<{ data: string; name: string }> — base64 images
    textSlides,   // Array<VideoTextSlide>
    settings,     // VideoGenSettings
    hfToken,      // string | null
    xaiToken,     // string | null — xAI Grok Imagine Video
  } = body;

  // Create a ReadableStream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream might be closed
        }
      };

      try {
        await generateVideo(
          images || [],
          textSlides || [],
          settings || { slideDuration: 3, transition: "fade", aspectRatio: "9:16", bgMusic: "none", mode: "kenburns" },
          hfToken || process.env.HUGGINGFACE_API_TOKEN || null,
          (event) => {
            sendEvent({ ...event });
          },
          xaiToken || process.env.XAI_API_KEY || null
        );
      } catch (err) {
        sendEvent({
          type: "error",
          message: `❌ Lỗi server: ${err instanceof Error ? err.message : "Unknown"}`,
        });
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
