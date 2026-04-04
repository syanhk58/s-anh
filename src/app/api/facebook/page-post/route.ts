import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

interface Config {
    facebook_messaging: {
        app_id: string;
        user_access_token: string;
    };
}

function loadConfig(): Config {
    const configPath = path.join(process.cwd(), "config", "script-generator.yaml");
    const raw = fs.readFileSync(configPath, "utf-8");
    return yaml.load(raw) as Config;
}

// ─── GET: Lấy danh sách Pages từ Facebook Graph API ──────────────────────────
export async function GET() {
    try {
        const config = loadConfig();
        const userToken = config.facebook_messaging.user_access_token;

        const res = await fetch(
            `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,picture{url}&limit=50&access_token=${userToken}`
        );
        const data = await res.json();

        if (data.error) {
            return NextResponse.json({ error: data.error.message }, { status: 400 });
        }

        const pages = (data.data || []).map((p: { id: string; name: string; access_token: string; picture?: { data?: { url?: string } } }) => ({
            id: p.id,
            name: p.name,
            accessToken: p.access_token,
            picture: p.picture?.data?.url || "",
        }));

        return NextResponse.json({ pages });
    } catch (error: unknown) {
        console.error("[page-post] GET error:", error);
        return NextResponse.json({ error: "Không lấy được danh sách pages" }, { status: 500 });
    }
}

// ─── POST: Đăng bài lên Page ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const pageId = formData.get("pageId") as string;
        const pageToken = formData.get("pageToken") as string;
        const message = formData.get("message") as string;
        const mediaType = formData.get("mediaType") as string; // "none" | "photo" | "video"

        if (!pageId || !pageToken) {
            return NextResponse.json({ error: "Thiếu pageId hoặc pageToken" }, { status: 400 });
        }

        // ═══ Text only ═══
        if (mediaType === "none" || !mediaType) {
            const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message,
                    access_token: pageToken,
                }),
            });
            const data = await res.json();
            if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });
            return NextResponse.json({ success: true, postId: data.id, type: "text" });
        }

        // ═══ Photo post ═══
        if (mediaType === "photo") {
            const photoFiles: File[] = [];
            const photoUrls: string[] = [];

            // Collect all photo entries
            for (const [key, value] of formData.entries()) {
                if (key.startsWith("photo") && value instanceof File) {
                    photoFiles.push(value);
                }
                if (key.startsWith("photoUrl") && typeof value === "string" && value.trim()) {
                    photoUrls.push(value.trim());
                }
            }

            // Single photo
            if (photoFiles.length === 1 && photoUrls.length === 0) {
                const file = photoFiles[0];
                const fbForm = new FormData();
                fbForm.append("source", file);
                if (message) fbForm.append("message", message);
                fbForm.append("access_token", pageToken);

                const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
                    method: "POST",
                    body: fbForm,
                });
                const data = await res.json();
                if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });
                return NextResponse.json({ success: true, postId: data.post_id || data.id, type: "photo" });
            }

            // Multiple photos — unpublished + batch
            if (photoFiles.length > 1 || photoUrls.length > 0) {
                const photoIds: string[] = [];

                // Upload each file as unpublished
                for (const file of photoFiles) {
                    const fbForm = new FormData();
                    fbForm.append("source", file);
                    fbForm.append("published", "false");
                    fbForm.append("access_token", pageToken);
                    const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
                        method: "POST",
                        body: fbForm,
                    });
                    const data = await res.json();
                    if (data.id) photoIds.push(data.id);
                }

                // Upload URLs as unpublished
                for (const url of photoUrls) {
                    const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            url,
                            published: false,
                            access_token: pageToken,
                        }),
                    });
                    const data = await res.json();
                    if (data.id) photoIds.push(data.id);
                }

                // Create multi-photo post
                const attachedMedia = photoIds.map(id => ({ media_fbid: id }));
                const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message,
                        attached_media: attachedMedia,
                        access_token: pageToken,
                    }),
                });
                const data = await res.json();
                if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });
                return NextResponse.json({ success: true, postId: data.id, type: "multi_photo", count: photoIds.length });
            }
        }

        // ═══ Video post ═══
        if (mediaType === "video") {
            const videoFile = formData.get("video") as File | null;
            const videoUrl = formData.get("videoUrl") as string | null;

            if (videoFile) {
                const fbForm = new FormData();
                fbForm.append("source", videoFile);
                if (message) fbForm.append("description", message);
                fbForm.append("access_token", pageToken);

                const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/videos`, {
                    method: "POST",
                    body: fbForm,
                });
                const data = await res.json();
                if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });
                return NextResponse.json({ success: true, postId: data.id, type: "video" });
            }

            if (videoUrl) {
                const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/videos`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        file_url: videoUrl,
                        description: message || "",
                        access_token: pageToken,
                    }),
                });
                const data = await res.json();
                if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });
                return NextResponse.json({ success: true, postId: data.id, type: "video_url" });
            }
        }

        return NextResponse.json({ error: "Không xác định được loại media" }, { status: 400 });
    } catch (error: unknown) {
        console.error("[page-post] POST error:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
