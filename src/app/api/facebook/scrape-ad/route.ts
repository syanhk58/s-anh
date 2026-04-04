import { NextRequest, NextResponse } from "next/server";

// ─── POST: Scrape Facebook Ad Library page ────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();

        if (!url || (!url.includes("facebook.com/ads/library") && !url.includes("fb.com/ads/library"))) {
            return NextResponse.json({ error: "URL không phải từ Facebook Ad Library" }, { status: 400 });
        }

        // Fetch the Ad Library page HTML
        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
            },
        });

        if (!res.ok) {
            return NextResponse.json({ error: `Không truy cập được link: HTTP ${res.status}` }, { status: 400 });
        }

        const html = await res.text();

        // Extract ad text content
        const texts: string[] = [];

        // Method 1: Look for _7jyr class (ad body text)
        const textMatches = html.matchAll(/<div[^>]*class="[^"]*_7jyr[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);
        for (const m of textMatches) {
            const clean = m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
            if (clean.length > 10) texts.push(clean);
        }

        // Method 2: Look for preformatted text in JSON data
        const jsonMatches = html.matchAll(/"body":\s*\{[^}]*"text":\s*"([^"]+)"/gi);
        for (const m of jsonMatches) {
            const t = m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').trim();
            if (t.length > 10 && !texts.includes(t)) texts.push(t);
        }

        // Method 3: Search for ad_creative_bodies in page data
        const bodyMatches = html.matchAll(/"ad_creative_bodies":\s*\["([^"]+)"/gi);
        for (const m of bodyMatches) {
            const t = m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').trim();
            if (t.length > 10 && !texts.includes(t)) texts.push(t);
        }

        // Extract image URLs
        const images: string[] = [];
        const imgMatches = html.matchAll(/(?:src|href)="(https:\/\/(?:scontent|external)[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/gi);
        for (const m of imgMatches) {
            const imgUrl = m[1].replace(/&amp;/g, "&");
            if (!images.includes(imgUrl) && images.length < 10) {
                images.push(imgUrl);
            }
        }

        // Extract video URLs
        const videos: string[] = [];
        const vidMatches = html.matchAll(/(?:src|href)="(https:\/\/[^"]*\.(?:mp4|mov)[^"]*)"/gi);
        for (const m of vidMatches) {
            const vidUrl = m[1].replace(/&amp;/g, "&");
            if (!videos.includes(vidUrl) && videos.length < 5) {
                videos.push(vidUrl);
            }
        }

        // Also check for video_hd_url or video_sd_url in embedded data
        const vhdMatches = html.matchAll(/"(?:video_hd_url|video_sd_url|playable_url)":\s*"([^"]+)"/gi);
        for (const m of vhdMatches) {
            const vidUrl = m[1].replace(/\\\//g, "/").replace(/&amp;/g, "&");
            if (!videos.includes(vidUrl) && videos.length < 5) {
                videos.push(vidUrl);
            }
        }

        return NextResponse.json({
            success: true,
            text: texts[0] || "",
            allTexts: texts,
            images,
            videos,
            scraped: true,
        });
    } catch (error: unknown) {
        console.error("[scrape-ad] Error:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
