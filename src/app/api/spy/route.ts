import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const SPY_OUTPUT_DIR = path.join(process.cwd(), "spy-data", "output");

function getLatestDate(): string | null {
    if (!fs.existsSync(SPY_OUTPUT_DIR)) return null;
    const folders = fs.readdirSync(SPY_OUTPUT_DIR)
        .filter(f => f.match(/^20\d{2}-\d{2}-\d{2}$/))
        .sort();
    return folders.length > 0 ? folders[folders.length - 1] : null;
}

function loadSpyData(date?: string | null) {
    const targetDate = date || getLatestDate();
    if (!targetDate) return { products: [], date: null };
    
    const filePath = path.join(SPY_OUTPUT_DIR, targetDate, "data.json");
    if (!fs.existsSync(filePath)) return { products: [], date: targetDate };
    
    const raw = fs.readFileSync(filePath, "utf-8");
    const products = JSON.parse(raw);
    return { products, date: targetDate };
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    
    const { products, date: resolvedDate } = loadSpyData(date);
    
    const hot = products.filter((p: any) => p.tier === "HOT").length;
    const watch = products.filter((p: any) => p.tier === "WATCH").length;
    const skip = products.filter((p: any) => p.tier === "SKIP").length;
    
    // Get available dates
    let dates: string[] = [];
    if (fs.existsSync(SPY_OUTPUT_DIR)) {
        dates = fs.readdirSync(SPY_OUTPUT_DIR)
            .filter(f => f.match(/^20\d{2}-\d{2}-\d{2}$/))
            .sort()
            .reverse();
    }
    
    return NextResponse.json({
        date: resolvedDate,
        total: products.length,
        summary: { hot, watch, skip },
        products,
        available_dates: dates,
    });
}
