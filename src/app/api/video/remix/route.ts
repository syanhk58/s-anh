import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, mkdirSync, unlinkSync, existsSync } from "fs";
import path from "path";

const FFMPEG = require("ffmpeg-static") as string;
const FFPROBE = require("ffprobe-static").path as string;

export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface RemixRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export async function POST(req: NextRequest) {
  const workDir = path.join(process.cwd(), ".video-tmp", `remix-${Date.now()}`);
  mkdirSync(workDir, { recursive: true });

  try {
    const formData = await req.formData();
    const videoFile = formData.get("video") as File | null;
    const regionsJson = formData.get("regions") as string | null;
    const mode = (formData.get("mode") as string) || "delogo"; // delogo | blur

    if (!videoFile) {
      return NextResponse.json({ error: "Không có video" }, { status: 400 });
    }

    const regions: RemixRegion[] = regionsJson ? JSON.parse(regionsJson) : [];
    if (regions.length === 0) {
      return NextResponse.json({ error: "Chưa chọn vùng cần xóa" }, { status: 400 });
    }

    // Save uploaded video to disk
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    const inputExt = videoFile.name.split(".").pop() || "mp4";
    const inputPath = path.join(workDir, `input.${inputExt}`);
    writeFileSync(inputPath, videoBuffer);

    // Get video dimensions
    let videoWidth = 1920;
    let videoHeight = 1080;
    try {
      const probeOutput = execSync(
        `"${FFPROBE}" -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${inputPath}"`,
        { stdio: "pipe" }
      ).toString().trim();
      const [w, h] = probeOutput.split("x").map(Number);
      if (w && h) {
        videoWidth = w;
        videoHeight = h;
      }
    } catch {
      // Use defaults
    }

    // Build FFmpeg filter chain
    const outputFilename = `remix-${Date.now()}.mp4`;
    const outputDir = path.join(process.cwd(), "public", "generated-videos");
    mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, outputFilename);

    if (mode === "blur") {
      // Use boxblur for each region
      const filterParts = regions.map((r, i) => {
        // Clamp values
        const x = Math.max(0, Math.round(r.x));
        const y = Math.max(0, Math.round(r.y));
        const w = Math.min(Math.round(r.w), videoWidth - x);
        const h = Math.min(Math.round(r.h), videoHeight - y);
        return `[0:v]crop=${w}:${h}:${x}:${y},avgblur=sizeX=30:sizeY=30[blur${i}]`;
      });

      const overlayParts = regions.map((r, i) => {
        const x = Math.max(0, Math.round(r.x));
        const y = Math.max(0, Math.round(r.y));
        const prevLabel = i === 0 ? "[0:v]" : `[ov${i - 1}]`;
        const outLabel = i === regions.length - 1 ? "[outv]" : `[ov${i}]`;
        return `${prevLabel}[blur${i}]overlay=${x}:${y}${outLabel}`;
      });

      const filterComplex = [...filterParts, ...overlayParts].join(";");

      execSync(
        `"${FFMPEG}" -y -i "${inputPath}" -filter_complex "${filterComplex}" -map "[outv]" -map 0:a? -c:v libx264 -preset fast -crf 18 -c:a copy "${outputPath}" 2>/dev/null`,
        { stdio: "pipe", timeout: 240000 }
      );
    } else {
      // Use delogo filter (better quality for logo removal)
      // Chain multiple delogo filters for multiple regions
      const delogoFilters = regions.map(r => {
        const x = Math.max(0, Math.round(r.x));
        const y = Math.max(0, Math.round(r.y));
        const w = Math.min(Math.round(r.w), videoWidth - x);
        const h = Math.min(Math.round(r.h), videoHeight - y);
        return `delogo=x=${x}:y=${y}:w=${w}:h=${h}`;
      });

      const filterChain = delogoFilters.join(",");

      execSync(
        `"${FFMPEG}" -y -i "${inputPath}" -vf "${filterChain}" -c:v libx264 -preset fast -crf 18 -c:a copy "${outputPath}" 2>/dev/null`,
        { stdio: "pipe", timeout: 240000 }
      );
    }

    // Get output video info
    let duration = "";
    let fileSize = "";
    try {
      const probeOut = execSync(
        `"${FFPROBE}" -v error -show_entries format=duration,size -of default=noprint_wrappers=1 "${outputPath}"`,
        { stdio: "pipe" }
      ).toString().trim();
      const durationMatch = probeOut.match(/duration=([\d.]+)/);
      const sizeMatch = probeOut.match(/size=(\d+)/);
      if (durationMatch) {
        const secs = parseFloat(durationMatch[1]);
        const mins = Math.floor(secs / 60);
        const remainSecs = Math.round(secs % 60);
        duration = `${mins}:${remainSecs.toString().padStart(2, "0")}`;
      }
      if (sizeMatch) {
        const bytes = parseInt(sizeMatch[1]);
        fileSize = bytes > 1048576
          ? `${(bytes / 1048576).toFixed(1)} MB`
          : `${(bytes / 1024).toFixed(0)} KB`;
      }
    } catch { /* ignore */ }

    // Cleanup temp files
    try {
      unlinkSync(inputPath);
      execSync(`rm -rf "${workDir}" 2>/dev/null`, { stdio: "pipe" });
    } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      downloadUrl: `/generated-videos/${outputFilename}`,
      duration,
      fileSize,
      regionsCount: regions.length,
    });
  } catch (err) {
    // Cleanup on error
    try {
      execSync(`rm -rf "${workDir}" 2>/dev/null`, { stdio: "pipe" });
    } catch { /* ignore */ }

    return NextResponse.json(
      { error: `Lỗi xử lý video: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
