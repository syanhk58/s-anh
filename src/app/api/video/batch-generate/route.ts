import { NextRequest } from "next/server";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

export const maxDuration = 300; // 5 minutes
export const dynamic = "force-dynamic";

const FFMPEG = require("ffmpeg-static") as string;

interface BatchProduct {
  id: string;
  name: string;
  price: string;
  salePrice?: string;
  ctaText: string;
  script: string;        // Full voiceover text
  voiceUrl?: string;      // Pre-generated voiceover URL
  images: { data: string; name: string }[];  // base64 images
}

interface BatchSettings {
  aspectRatio: "9:16" | "1:1" | "16:9";
  slideDuration: number;
  mode: "kenburns" | "grok" | "ai";
  subtitleStyle: "none" | "simple";
  priceOverlay: boolean;
  ctaPosition: "top" | "bottom";
  musicType: string;
}

function getResolution(aspectRatio: string): { w: number; h: number } {
  switch (aspectRatio) {
    case "9:16": return { w: 720, h: 1280 };
    case "1:1": return { w: 720, h: 720 };
    case "16:9": return { w: 1280, h: 720 };
    default: return { w: 720, h: 1280 };
  }
}

/**
 * POST /api/video/batch-generate
 * 
 * Generates affiliate videos in batch with SSE progress.
 * For each product:
 *  1. Create Ken Burns clips from product images
 *  2. Overlay CTA text + price badge
 *  3. Add subtitle from script
 *  4. Concatenate into final video
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    products,     // BatchProduct[]
    settings,     // BatchSettings
    xaiToken,
    hfToken,
  } = body as {
    products: BatchProduct[];
    settings: BatchSettings;
    xaiToken?: string;
    hfToken?: string;
  };

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* stream closed */ }
      };

      const resolution = getResolution(settings.aspectRatio);
      const batchDir = path.join(process.cwd(), ".video-tmp", `batch-${Date.now()}`);
      mkdirSync(batchDir, { recursive: true });

      const outputDir = path.join(process.cwd(), "public", "generated-videos");
      mkdirSync(outputDir, { recursive: true });

      const generatedVideos: { productId: string; name: string; url: string }[] = [];

      send({
        type: "batch_start",
        message: `🚀 Bắt đầu tạo ${products.length} video affiliate | Mode: ${settings.mode} | ${settings.aspectRatio}`,
        total: products.length,
      });

      for (let pi = 0; pi < products.length; pi++) {
        const product = products[pi];
        const productDir = path.join(batchDir, `product-${pi}`);
        mkdirSync(productDir, { recursive: true });

        send({
          type: "product_start",
          message: `📦 [${pi + 1}/${products.length}] Bắt đầu: ${product.name}`,
          index: pi + 1,
          total: products.length,
          productId: product.id,
        });

        try {
          const clipPaths: string[] = [];

          // ── Step 1: Create clips from product images ──
          for (let ii = 0; ii < product.images.length; ii++) {
            const imgPath = path.join(productDir, `img-${ii}.png`);
            const clipPath = path.join(productDir, `clip-${ii}.mp4`);

            // Save image
            const imgData = product.images[ii].data.replace(/^data:image\/\w+;base64,/, "");
            writeFileSync(imgPath, Buffer.from(imgData, "base64"));

            // Resize
            const resizedPath = path.join(productDir, `img-${ii}-r.png`);
            try {
              execSync(
                `"${FFMPEG}" -y -i "${imgPath}" -vf "scale=${resolution.w}:${resolution.h}:force_original_aspect_ratio=decrease,pad=${resolution.w}:${resolution.h}:(ow-iw)/2:(oh-ih)/2:black" "${resizedPath}" 2>/dev/null`,
                { stdio: "pipe", timeout: 10000 }
              );
            } catch {
              execSync(`cp "${imgPath}" "${resizedPath}"`, { stdio: "pipe" });
            }

            // Ken Burns effect
            const fps = 30;
            const dur = settings.slideDuration;
            const effects = [
              `zoompan=z='min(zoom+0.001,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${dur * fps}:s=${resolution.w}x${resolution.h}:fps=${fps}`,
              `zoompan=z='if(lte(zoom,1.0),1.3,max(1.001,zoom-0.001))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${dur * fps}:s=${resolution.w}x${resolution.h}:fps=${fps}`,
              `zoompan=z='1.2':x='if(lte(on,1),0,min(iw/zoom-iw/zoom/2,x+1))':y='ih/2-(ih/zoom/2)':d=${dur * fps}:s=${resolution.w}x${resolution.h}:fps=${fps}`,
              `zoompan=z='1.2':x='if(lte(on,1),iw/zoom-iw,max(0,x-1))':y='ih/2-(ih/zoom/2)':d=${dur * fps}:s=${resolution.w}x${resolution.h}:fps=${fps}`,
            ];
            const effect = effects[ii % effects.length];

            execSync(
              `"${FFMPEG}" -y -loop 1 -i "${resizedPath}" -vf "${effect},fade=t=in:st=0:d=0.3,fade=t=out:st=${dur - 0.3}:d=0.3" -t ${dur} -pix_fmt yuv420p -c:v libx264 -preset fast "${clipPath}" 2>/dev/null`,
              { stdio: "pipe", timeout: 30000 }
            );

            clipPaths.push(clipPath);

            send({
              type: "clip_done",
              message: `  ✅ Clip ${ii + 1}/${product.images.length} xong`,
              productId: product.id,
            });
          }

          if (clipPaths.length === 0) {
            send({
              type: "product_error",
              message: `  ❌ Không có ảnh nào cho ${product.name}`,
              productId: product.id,
            });
            continue;
          }

          // ── Step 2: Concatenate clips ──
          send({
            type: "stitching",
            message: `  🔗 Ghép ${clipPaths.length} clips...`,
            productId: product.id,
          });

          const rawVideoPath = path.join(productDir, "raw.mp4");
          if (clipPaths.length === 1) {
            execSync(`cp "${clipPaths[0]}" "${rawVideoPath}"`, { stdio: "pipe" });
          } else {
            const concatFile = path.join(productDir, "concat.txt");
            writeFileSync(concatFile, clipPaths.map(p => `file '${p}'`).join("\n"));
            execSync(
              `"${FFMPEG}" -y -f concat -safe 0 -i "${concatFile}" -c:v libx264 -preset fast -pix_fmt yuv420p "${rawVideoPath}" 2>/dev/null`,
              { stdio: "pipe", timeout: 60000 }
            );
          }

          // ── Step 3: Add CTA overlay + Price badge ──
          send({
            type: "overlay",
            message: `  🏷️ Thêm CTA + giá...`,
            productId: product.id,
          });

          const overlayVideoPath = path.join(productDir, "overlay.mp4");
          const ctaText = (product.ctaText || "Link ở bio 👇").replace(/'/g, "'\\''").replace(/:/g, "\\:");
          const priceText = product.salePrice
            ? `${product.salePrice}`.replace(/'/g, "'\\''").replace(/:/g, "\\:")
            : product.price.replace(/'/g, "'\\''").replace(/:/g, "\\:");

          // Build drawtext filters
          let filterParts: string[] = [];

          // CTA text at bottom
          if (settings.ctaPosition === "bottom") {
            filterParts.push(
              `drawtext=text='${ctaText}':fontsize=32:fontcolor=white:x=(w-text_w)/2:y=h-80:font=Arial:borderw=3:bordercolor=black@0.7:box=1:boxcolor=black@0.5:boxborderw=12`
            );
          } else {
            filterParts.push(
              `drawtext=text='${ctaText}':fontsize=32:fontcolor=white:x=(w-text_w)/2:y=60:font=Arial:borderw=3:bordercolor=black@0.7:box=1:boxcolor=black@0.5:boxborderw=12`
            );
          }

          // Price badge (top-right)
          if (settings.priceOverlay && priceText) {
            filterParts.push(
              `drawtext=text='${priceText}':fontsize=36:fontcolor=yellow:x=w-text_w-30:y=30:font=Arial:borderw=3:bordercolor=black@0.8:box=1:boxcolor=red@0.7:boxborderw=10`
            );
          }

          // Product name (top-left)
          const safeName = product.name.substring(0, 30).replace(/'/g, "'\\''").replace(/:/g, "\\:");
          filterParts.push(
            `drawtext=text='${safeName}':fontsize=24:fontcolor=white:x=20:y=20:font=Arial:borderw=2:bordercolor=black@0.6`
          );

          try {
            execSync(
              `"${FFMPEG}" -y -i "${rawVideoPath}" -vf "${filterParts.join(",")}" -c:v libx264 -preset fast -pix_fmt yuv420p "${overlayVideoPath}" 2>/dev/null`,
              { stdio: "pipe", timeout: 60000 }
            );
          } catch {
            // Fallback: use raw video without overlay
            execSync(`cp "${rawVideoPath}" "${overlayVideoPath}"`, { stdio: "pipe" });
          }

          // ── Step 4: Add voiceover audio (if provided) ──
          const finalFilename = `affiliate-${product.id}-${Date.now()}.mp4`;
          const finalPath = path.join(outputDir, finalFilename);

          if (product.voiceUrl) {
            send({
              type: "audio",
              message: `  🎤 Thêm voiceover...`,
              productId: product.id,
            });

            const audioPath = path.join(process.cwd(), "public", product.voiceUrl);
            if (existsSync(audioPath)) {
              try {
                execSync(
                  `"${FFMPEG}" -y -i "${overlayVideoPath}" -i "${audioPath}" -c:v copy -c:a aac -shortest "${finalPath}" 2>/dev/null`,
                  { stdio: "pipe", timeout: 30000 }
                );
              } catch {
                execSync(`cp "${overlayVideoPath}" "${finalPath}"`, { stdio: "pipe" });
              }
            } else {
              execSync(`cp "${overlayVideoPath}" "${finalPath}"`, { stdio: "pipe" });
            }
          } else {
            execSync(`cp "${overlayVideoPath}" "${finalPath}"`, { stdio: "pipe" });
          }

          const downloadUrl = `/generated-videos/${finalFilename}`;
          generatedVideos.push({
            productId: product.id,
            name: product.name,
            url: downloadUrl,
          });

          send({
            type: "product_done",
            message: `  🎉 Hoàn thành: ${product.name}`,
            index: pi + 1,
            total: products.length,
            productId: product.id,
            downloadUrl,
          });

        } catch (err) {
          send({
            type: "product_error",
            message: `  ❌ Lỗi ${product.name}: ${err instanceof Error ? err.message : "Unknown"}`,
            productId: product.id,
            index: pi + 1,
            total: products.length,
          });
        }
      }

      // ── Batch complete ──
      send({
        type: "batch_complete",
        message: `🏁 Hoàn thành ${generatedVideos.length}/${products.length} video!`,
        total: products.length,
        completed: generatedVideos.length,
        videos: generatedVideos,
      });

      // Cleanup temp
      try {
        execSync(`rm -rf "${batchDir}" 2>/dev/null`, { stdio: "pipe" });
      } catch { /* ignore */ }

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
