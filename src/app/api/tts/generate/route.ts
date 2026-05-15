import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Text-to-Speech API
 * Uses Edge TTS via command-line (edge-tts Python package)
 * or falls back to a simple espeak/say approach.
 *
 * POST /api/tts/generate
 * Body: { text: string, voice?: string, lang?: string, engine?: string }
 * Returns: { audioUrl: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { text, voice, lang = "vi", engine = "edge-tts" } = await req.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const outputDir = path.join(process.cwd(), "public", "generated-audio");
    mkdirSync(outputDir, { recursive: true });

    const filename = `tts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.mp3`;
    const outputPath = path.join(outputDir, filename);

    // Select voice based on language
    const voiceMap: Record<string, string> = {
      vi: voice || "vi-VN-HoaiMyNeural",
      en: voice || "en-US-JennyNeural",
      ar: voice || "ar-SA-ZariyahNeural",
    };

    const selectedVoice = voiceMap[lang] || voiceMap.vi;

    if (engine === "edge-tts") {
      // Try Edge TTS (requires: pip install edge-tts)
      const success = await generateEdgeTTS(text, selectedVoice, outputPath);
      if (success) {
        return NextResponse.json({ audioUrl: `/generated-audio/${filename}` });
      }
    }

    // Fallback: use macOS `say` command or espeak
    const fallbackSuccess = generateFallbackTTS(text, lang, outputPath);
    if (fallbackSuccess) {
      return NextResponse.json({ audioUrl: `/generated-audio/${filename}` });
    }

    return NextResponse.json({ error: "TTS generation failed. Install edge-tts: pip install edge-tts" }, { status: 500 });
  } catch (err) {
    return NextResponse.json(
      { error: `TTS error: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 }
    );
  }
}

async function generateEdgeTTS(text: string, voice: string, outputPath: string): Promise<boolean> {
  try {
    // Write text to temp file to avoid shell escaping issues
    const textFile = outputPath.replace(".mp3", ".txt");
    writeFileSync(textFile, text, "utf-8");

    execSync(
      `edge-tts --voice "${voice}" --file "${textFile}" --write-media "${outputPath}" 2>/dev/null`,
      { stdio: "pipe", timeout: 30000 }
    );

    // Clean up text file
    try { execSync(`rm "${textFile}"`, { stdio: "pipe" }); } catch { /* ignore */ }

    return true;
  } catch {
    return false;
  }
}

function generateFallbackTTS(text: string, lang: string, outputPath: string): boolean {
  try {
    // macOS: use `say` command
    if (process.platform === "darwin") {
      const aiffPath = outputPath.replace(".mp3", ".aiff");
      const voiceMap: Record<string, string> = {
        vi: "Linh",    // Vietnamese voice on macOS
        en: "Samantha",
        ar: "Maged",
      };
      const voice = voiceMap[lang] || "Samantha";

      // Write text to temp file
      const textFile = outputPath.replace(".mp3", ".txt");
      writeFileSync(textFile, text, "utf-8");

      execSync(`say -v ${voice} -o "${aiffPath}" < "${textFile}" 2>/dev/null`, { stdio: "pipe", timeout: 30000 });

      // Convert to mp3 using ffmpeg
      const FFMPEG = require("ffmpeg-static") as string;
      execSync(`"${FFMPEG}" -y -i "${aiffPath}" -codec:a libmp3lame -qscale:a 4 "${outputPath}" 2>/dev/null`, { stdio: "pipe", timeout: 15000 });

      // Cleanup
      try {
        execSync(`rm "${aiffPath}" "${textFile}"`, { stdio: "pipe" });
      } catch { /* ignore */ }

      return true;
    }
    return false;
  } catch {
    return false;
  }
}
