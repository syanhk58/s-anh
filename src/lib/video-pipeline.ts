/**
 * Video Generation Pipeline
 * 
 * Flow:
 * 1. For each image → call HuggingFace API to animate (image-to-video)
 *    OR fallback to Ken Burns effect via FFmpeg
 * 2. For each text slide → render as video clip via FFmpeg
 * 3. Concatenate all clips with transitions via FFmpeg
 * 4. Add background music if selected
 * 5. Output final MP4
 */

import { execSync } from "child_process";
import { writeFileSync, readFileSync, mkdirSync, unlinkSync, readdirSync } from "fs";
import path from "path";

// Use bundled ffmpeg/ffprobe binaries (no system install needed)
const FFMPEG = require("ffmpeg-static") as string;
const FFPROBE = require("ffprobe-static").path as string;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface VideoTextSlide {
  text: string;
  fontSize: "small" | "medium" | "large";
  position: "top" | "center" | "bottom";
  textColor: string;
  bgColor: string;
}

export interface VideoGenSettings {
  slideDuration: number;
  transition: "fade" | "slide" | "zoom" | "none";
  aspectRatio: "16:9" | "9:16" | "1:1";
  bgMusic: string;
  mode: "ai" | "kenburns" | "grok"; // ai = HuggingFace, kenburns = FFmpeg only, grok = xAI Grok Imagine
}

export interface ProgressEvent {
  type: "info" | "clip_start" | "clip_done" | "clip_error" | "text_render" | "stitching" | "adding_music" | "complete" | "error";
  message: string;
  index?: number;
  total?: number;
  downloadUrl?: string;
}

type ProgressCallback = (event: ProgressEvent) => void;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const WORK_DIR = path.join(process.cwd(), ".video-tmp");

function ensureWorkDir(): string {
  const sessionDir = path.join(WORK_DIR, `session-${Date.now()}`);
  mkdirSync(sessionDir, { recursive: true });
  return sessionDir;
}

function getResolution(aspectRatio: string): { w: number; h: number } {
  switch (aspectRatio) {
    case "9:16": return { w: 720, h: 1280 };
    case "1:1": return { w: 720, h: 720 };
    case "16:9": return { w: 1280, h: 720 };
    default: return { w: 720, h: 1280 };
  }
}

function checkFFmpeg(): boolean {
  try {
    execSync(`"${FFMPEG}" -version`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

// ─── HuggingFace Image-to-Video ───────────────────────────────────────────────
async function animateImageWithAI(
  imagePath: string,
  outputPath: string,
  hfToken: string,
  duration: number
): Promise<boolean> {
  try {
    const imageBuffer = readFileSync(imagePath);

    // Try Stable Video Diffusion first
    const response = await fetch(
      "https://api-inference.huggingface.co/models/stabilityai/stable-video-diffusion-img2vid-xt",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfToken}`,
          "Content-Type": "application/octet-stream",
        },
        body: imageBuffer,
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`HuggingFace API error: ${response.status} - ${errText}`);
      
      // If model is loading, wait and retry once
      if (response.status === 503) {
        const errData = JSON.parse(errText);
        const waitTime = errData.estimated_time || 30;
        console.log(`Model loading, waiting ${waitTime}s...`);
        await new Promise(r => setTimeout(r, Math.min(waitTime * 1000, 60000)));
        
        // Retry
        const retryRes = await fetch(
          "https://api-inference.huggingface.co/models/stabilityai/stable-video-diffusion-img2vid-xt",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${hfToken}`,
              "Content-Type": "application/octet-stream",
            },
            body: imageBuffer,
          }
        );
        
        if (!retryRes.ok) return false;
        
        const videoBuffer = Buffer.from(await retryRes.arrayBuffer());
        writeFileSync(outputPath, videoBuffer);
        
        // Adjust duration if needed
        adjustClipDuration(outputPath, duration);
        return true;
      }
      
      return false;
    }

    const videoBuffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(outputPath, videoBuffer);
    
    // Adjust duration to match settings
    adjustClipDuration(outputPath, duration);
    return true;
  } catch (err) {
    console.error("AI animate error:", err);
    return false;
  }
}

function adjustClipDuration(videoPath: string, targetDuration: number) {
  try {
    const tmpPath = videoPath.replace(".mp4", "_adj.mp4");
    // Speed up or slow down to match target duration
    execSync(
      `"${FFMPEG}" -y -i "${videoPath}" -filter:v "setpts=PTS*${targetDuration}/4" -an "${tmpPath}" 2>/dev/null`,
      { stdio: "pipe" }
    );
    execSync(`mv "${tmpPath}" "${videoPath}"`, { stdio: "pipe" });
  } catch {
    // Keep original duration if adjustment fails
  }
}

// ─── Grok Imagine Video (xAI) ─────────────────────────────────────────────────
async function animateImageWithGrok(
  imagePath: string,
  outputPath: string,
  xaiApiKey: string,
  duration: number,
  prompt?: string
): Promise<boolean> {
  try {
    const imageBuffer = readFileSync(imagePath);
    const base64Image = `data:image/png;base64,${imageBuffer.toString("base64")}`;

    // Step 1: Start video generation
    const startRes = await fetch("https://api.x.ai/v1/videos/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${xaiApiKey}`,
      },
      body: JSON.stringify({
        model: "grok-imagine-video",
        prompt: prompt || "Animate this image with subtle cinematic camera movement, slow pan and gentle zoom. Keep the content faithful to the original image.",
        image: { url: base64Image },
        duration: Math.min(duration, 10), // Max 10s per xAI limit
      }),
    });

    if (!startRes.ok) {
      const errText = await startRes.text();
      console.error(`Grok API start error: ${startRes.status} - ${errText}`);
      return false;
    }

    const startData = await startRes.json();
    const requestId = startData.request_id;

    if (!requestId) {
      console.error("Grok API: no request_id returned");
      return false;
    }

    // Step 2: Poll for completion (max 3 minutes)
    const maxWait = 180_000;
    const pollInterval = 5_000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      await new Promise(r => setTimeout(r, pollInterval));

      const pollRes = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${xaiApiKey}` },
      });

      if (!pollRes.ok) {
        console.error(`Grok poll error: ${pollRes.status}`);
        continue;
      }

      const pollData = await pollRes.json();

      if (pollData.status === "done") {
        // Download the video
        const videoUrl = pollData.data?.video?.url || pollData.video?.url || pollData.url;
        if (!videoUrl) {
          console.error("Grok: video URL not found in response");
          return false;
        }

        const videoRes = await fetch(videoUrl);
        if (!videoRes.ok) return false;

        const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
        writeFileSync(outputPath, videoBuffer);

        // Adjust duration if needed
        adjustClipDuration(outputPath, duration);
        return true;
      }

      if (pollData.status === "expired" || pollData.status === "failed" || pollData.status === "error") {
        console.error(`Grok generation failed: ${pollData.status}`);
        return false;
      }

      // status === "pending" → continue polling
    }

    console.error("Grok: timed out waiting for video generation");
    return false;
  } catch (err) {
    console.error("Grok animate error:", err);
    return false;
  }
}

// ─── Ken Burns Effect (FFmpeg fallback) ───────────────────────────────────────
function createKenBurnsClip(
  imagePath: string,
  outputPath: string,
  duration: number,
  resolution: { w: number; h: number },
  effectVariant: number
): void {
  const { w, h } = resolution;
  const fps = 30;

  // Different Ken Burns effects for variety
  const effects = [
    // Slow zoom in
    `zoompan=z='min(zoom+0.001,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${duration * fps}:s=${w}x${h}:fps=${fps}`,
    // Slow zoom out
    `zoompan=z='if(lte(zoom,1.0),1.3,max(1.001,zoom-0.001))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${duration * fps}:s=${w}x${h}:fps=${fps}`,
    // Pan left to right
    `zoompan=z='1.2':x='if(lte(on,1),0,min(iw/zoom-iw/zoom/2,x+1))':y='ih/2-(ih/zoom/2)':d=${duration * fps}:s=${w}x${h}:fps=${fps}`,
    // Pan right to left  
    `zoompan=z='1.2':x='if(lte(on,1),iw/zoom-iw,max(0,x-1))':y='ih/2-(ih/zoom/2)':d=${duration * fps}:s=${w}x${h}:fps=${fps}`,
  ];

  const effect = effects[effectVariant % effects.length];

  execSync(
    `"${FFMPEG}" -y -loop 1 -i "${imagePath}" -vf "${effect},fade=t=in:st=0:d=0.5,fade=t=out:st=${duration - 0.5}:d=0.5" -t ${duration} -pix_fmt yuv420p -c:v libx264 -preset fast "${outputPath}" 2>/dev/null`,
    { stdio: "pipe", timeout: 30000 }
  );
}

// ─── Text Slide Rendering ─────────────────────────────────────────────────────
function renderTextSlide(
  text: string,
  slide: VideoTextSlide,
  outputPath: string,
  duration: number,
  resolution: { w: number; h: number }
): void {
  const { w, h } = resolution;
  const bgColor = slide.bgColor === "transparent" ? "0x1a1a2e" : slide.bgColor.replace("#", "0x");
  const textColor = slide.textColor.replace("#", "0x");
  const fontSize = slide.fontSize === "small" ? 28 : slide.fontSize === "large" ? 52 : 38;

  // Y position
  const yPos = slide.position === "top" ? "h*0.2" : slide.position === "bottom" ? "h*0.75" : "(h-text_h)/2";

  // Escape single quotes and special chars for FFmpeg
  const safeText = text.replace(/'/g, "'\\''").replace(/:/g, "\\:");

  execSync(
    `"${FFMPEG}" -y -f lavfi -i "color=c=${bgColor}:size=${w}x${h}:duration=${duration}:rate=30" ` +
    `-vf "drawtext=text='${safeText}':fontsize=${fontSize}:fontcolor=${textColor}:x=(w-text_w)/2:y=${yPos}:` +
    `font=Arial:borderw=2:bordercolor=black@0.5,` +
    `fade=t=in:st=0:d=0.5,fade=t=out:st=${duration - 0.5}:d=0.5" ` +
    `-pix_fmt yuv420p -c:v libx264 -preset fast "${outputPath}" 2>/dev/null`,
    { stdio: "pipe", timeout: 15000 }
  );
}

// ─── Concatenate Clips ────────────────────────────────────────────────────────
function concatenateClips(
  clipPaths: string[],
  outputPath: string,
  transition: string,
  sessionDir: string
): void {
  if (clipPaths.length === 0) return;

  if (clipPaths.length === 1) {
    execSync(`cp "${clipPaths[0]}" "${outputPath}"`, { stdio: "pipe" });
    return;
  }

  // Create concat file
  const concatFile = path.join(sessionDir, "concat.txt");
  const concatContent = clipPaths.map(p => `file '${p}'`).join("\n");
  writeFileSync(concatFile, concatContent);

  if (transition === "none" || transition === "slide") {
    // Simple concatenation
    execSync(
      `"${FFMPEG}" -y -f concat -safe 0 -i "${concatFile}" -c:v libx264 -preset fast -pix_fmt yuv420p "${outputPath}" 2>/dev/null`,
      { stdio: "pipe", timeout: 120000 }
    );
  } else {
    // For fade/zoom transitions, use xfade filter (max ~10 clips at a time due to complexity)
    // Fallback to simple concat for many clips
    if (clipPaths.length > 10) {
      execSync(
        `"${FFMPEG}" -y -f concat -safe 0 -i "${concatFile}" -c:v libx264 -preset fast -pix_fmt yuv420p "${outputPath}" 2>/dev/null`,
        { stdio: "pipe", timeout: 120000 }
      );
    } else {
      // Build xfade filter chain
      const transitionDuration = 0.5;
      const inputs = clipPaths.map((p) => `-i "${p}"`).join(" ");
      let filterParts: string[] = [];
      let prevLabel = "[0:v]";

      for (let i = 1; i < clipPaths.length; i++) {
        const outLabel = i === clipPaths.length - 1 ? "[outv]" : `[v${i}]`;
        const xfadeType = transition === "fade" ? "fade" : transition === "zoom" ? "smoothup" : "fade";
        // Approximate: each clip duration offset
        const offset = i * 3 - transitionDuration; // rough estimate
        filterParts.push(
          `${prevLabel}[${i}:v]xfade=transition=${xfadeType}:duration=${transitionDuration}:offset=${Math.max(0, offset)}${outLabel}`
        );
        prevLabel = outLabel.replace("[", "[").replace("]", "]");
        if (i < clipPaths.length - 1) prevLabel = `[v${i}]`;
      }

      try {
        execSync(
          `"${FFMPEG}" -y ${inputs} -filter_complex "${filterParts.join(";")}" -map "[outv]" -c:v libx264 -preset fast -pix_fmt yuv420p "${outputPath}" 2>/dev/null`,
          { stdio: "pipe", timeout: 120000 }
        );
      } catch {
        // Fallback to simple concat
        execSync(
          `"${FFMPEG}" -y -f concat -safe 0 -i "${concatFile}" -c:v libx264 -preset fast -pix_fmt yuv420p "${outputPath}" 2>/dev/null`,
          { stdio: "pipe", timeout: 120000 }
        );
      }
    }
  }
}

// ─── Add Background Music ─────────────────────────────────────────────────────
function addBackgroundMusic(
  videoPath: string,
  outputPath: string,
  musicType: string
): void {
  // For now, just copy the video without music
  // TODO: Add preset music files
  if (musicType === "none" || musicType === "custom") {
    execSync(`cp "${videoPath}" "${outputPath}"`, { stdio: "pipe" });
    return;
  }

  // Without actual music files, just copy
  execSync(`cp "${videoPath}" "${outputPath}"`, { stdio: "pipe" });
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────
function cleanupSession(sessionDir: string) {
  try {
    const files = readdirSync(sessionDir);
    files.forEach(f => {
      try { unlinkSync(path.join(sessionDir, f)); } catch { /* ignore */ }
    });
    execSync(`rm -rf "${sessionDir}" 2>/dev/null`, { stdio: "pipe" });
  } catch { /* ignore */ }
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────
export async function generateVideo(
  images: { data: string; name: string }[], // base64 encoded
  textSlides: VideoTextSlide[],
  settings: VideoGenSettings,
  hfToken: string | null,
  onProgress: ProgressCallback,
  xaiApiKey?: string | null
): Promise<string | null> {
  // Validate
  if (!checkFFmpeg()) {
    onProgress({ type: "error", message: "❌ FFmpeg binary không tìm thấy. Chạy: npm install ffmpeg-static" });
    return null;
  }

  const useAI = settings.mode === "ai" && !!hfToken;
  const useGrok = settings.mode === "grok" && !!xaiApiKey;
  const sessionDir = ensureWorkDir();
  const resolution = getResolution(settings.aspectRatio);
  const clipPaths: string[] = [];
  const totalSteps = images.length + textSlides.filter(s => s.text.trim()).length;

  const modeLabel = useGrok ? "Grok Imagine" : useAI ? "AI Animate" : "Ken Burns";
  onProgress({
    type: "info",
    message: `🎬 Bắt đầu tạo video: ${images.length} ảnh + ${textSlides.filter(s => s.text.trim()).length} text slides | Mode: ${modeLabel} | ${settings.aspectRatio}`,
  });

  try {
    // ── Step 1: Process images ──────────────────────────────────────────
    for (let i = 0; i < images.length; i++) {
      const clipPath = path.join(sessionDir, `clip-${i}.mp4`);
      const imgPath = path.join(sessionDir, `img-${i}.png`);

      onProgress({
        type: "clip_start",
        message: `🖼️ [${i + 1}/${totalSteps}] Đang xử lý ảnh: ${images[i].name}...`,
        index: i + 1,
        total: totalSteps,
      });

      // Save image to disk
      const imgData = images[i].data.replace(/^data:image\/\w+;base64,/, "");
      writeFileSync(imgPath, Buffer.from(imgData, "base64"));

      // Resize image to match aspect ratio first
      const resizedPath = path.join(sessionDir, `img-${i}-resized.png`);
      try {
        execSync(
          `"${FFMPEG}" -y -i "${imgPath}" -vf "scale=${resolution.w}:${resolution.h}:force_original_aspect_ratio=decrease,pad=${resolution.w}:${resolution.h}:(ow-iw)/2:(oh-ih)/2:black" "${resizedPath}" 2>/dev/null`,
          { stdio: "pipe", timeout: 10000 }
        );
      } catch {
        execSync(`cp "${imgPath}" "${resizedPath}"`, { stdio: "pipe" });
      }

      if (useGrok) {
        // Try Grok Imagine Video
        onProgress({
          type: "clip_start",
          message: `🚀 [${i + 1}/${totalSteps}] Grok đang tạo video từ ảnh ${i + 1}... (có thể mất 30-120 giây)`,
          index: i + 1,
          total: totalSteps,
        });

        const grokSuccess = await animateImageWithGrok(resizedPath, clipPath, xaiApiKey!, settings.slideDuration);

        if (!grokSuccess) {
          onProgress({
            type: "clip_error",
            message: `⚠️ Grok fail ảnh ${i + 1}, dùng Ken Burns fallback`,
            index: i + 1,
            total: totalSteps,
          });
          createKenBurnsClip(resizedPath, clipPath, settings.slideDuration, resolution, i);
        }
      } else if (useAI) {
        // Try HuggingFace AI animation
        onProgress({
          type: "clip_start",
          message: `🤖 [${i + 1}/${totalSteps}] AI đang animate ảnh ${i + 1}... (có thể mất 30-120 giây)`,
          index: i + 1,
          total: totalSteps,
        });

        const aiSuccess = await animateImageWithAI(resizedPath, clipPath, hfToken!, settings.slideDuration);

        if (!aiSuccess) {
          onProgress({
            type: "clip_error",
            message: `⚠️ AI fail ảnh ${i + 1}, dùng Ken Burns fallback`,
            index: i + 1,
            total: totalSteps,
          });
          createKenBurnsClip(resizedPath, clipPath, settings.slideDuration, resolution, i);
        }
      } else {
        // Ken Burns mode
        createKenBurnsClip(resizedPath, clipPath, settings.slideDuration, resolution, i);
      }

      clipPaths.push(clipPath);
      onProgress({
        type: "clip_done",
        message: `✅ [${i + 1}/${totalSteps}] Xong ảnh ${i + 1}`,
        index: i + 1,
        total: totalSteps,
      });
    }

    // ── Step 2: Process text slides ─────────────────────────────────────
    const validTextSlides = textSlides.filter(s => s.text.trim());
    for (let i = 0; i < validTextSlides.length; i++) {
      const slideIdx = images.length + i;
      const clipPath = path.join(sessionDir, `text-${i}.mp4`);

      onProgress({
        type: "text_render",
        message: `📝 [${slideIdx + 1}/${totalSteps}] Đang render text slide ${i + 1}...`,
        index: slideIdx + 1,
        total: totalSteps,
      });

      try {
        renderTextSlide(validTextSlides[i].text, validTextSlides[i], clipPath, settings.slideDuration, resolution);
        clipPaths.push(clipPath);
      } catch (err) {
        onProgress({
          type: "clip_error",
          message: `⚠️ Lỗi render text ${i + 1}: ${err instanceof Error ? err.message : "Unknown"}`,
          index: slideIdx + 1,
          total: totalSteps,
        });
      }

      onProgress({
        type: "clip_done",
        message: `✅ [${slideIdx + 1}/${totalSteps}] Xong text slide ${i + 1}`,
        index: slideIdx + 1,
        total: totalSteps,
      });
    }

    if (clipPaths.length === 0) {
      onProgress({ type: "error", message: "❌ Không có clip nào được tạo thành công" });
      cleanupSession(sessionDir);
      return null;
    }

    // ── Step 3: Concatenate ─────────────────────────────────────────────
    onProgress({
      type: "stitching",
      message: `🔗 Đang ghép ${clipPaths.length} clips thành video...`,
    });

    const stitchedPath = path.join(sessionDir, "stitched.mp4");
    concatenateClips(clipPaths, stitchedPath, settings.transition, sessionDir);

    // ── Step 4: Add music ───────────────────────────────────────────────
    const finalFilename = `video-${Date.now()}.mp4`;
    const outputDir = path.join(process.cwd(), "public", "generated-videos");
    mkdirSync(outputDir, { recursive: true });
    const finalPath = path.join(outputDir, finalFilename);

    if (settings.bgMusic !== "none") {
      onProgress({ type: "adding_music", message: "🎵 Đang thêm nhạc nền..." });
    }

    addBackgroundMusic(stitchedPath, finalPath, settings.bgMusic);

    // ── Step 5: Complete ────────────────────────────────────────────────
    const downloadUrl = `/generated-videos/${finalFilename}`;

    // Get video info
    let durationInfo = "";
    try {
      const probe = execSync(
        `"${FFPROBE}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${finalPath}" 2>/dev/null`,
        { stdio: "pipe" }
      ).toString().trim();
      const secs = parseFloat(probe);
      const mins = Math.floor(secs / 60);
      const remainSecs = Math.round(secs % 60);
      durationInfo = ` | ${mins}:${remainSecs.toString().padStart(2, "0")}`;
    } catch { /* ignore */ }

    onProgress({
      type: "complete",
      message: `🎉 Video hoàn thành! ${clipPaths.length} clips${durationInfo} | ${settings.aspectRatio}`,
      downloadUrl,
    });

    // Cleanup temp files (keep final video)
    cleanupSession(sessionDir);

    return downloadUrl;
  } catch (err) {
    onProgress({
      type: "error",
      message: `❌ Lỗi: ${err instanceof Error ? err.message : "Unknown error"}`,
    });
    cleanupSession(sessionDir);
    return null;
  }
}
