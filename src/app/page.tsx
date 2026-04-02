"use client";
import { useState } from "react";
import { Search, FileText } from "lucide-react";
import SpyBoard from "@/components/spy-board";
import ScriptGenerator from "@/components/script-generator";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "spy",    label: "Tìm SP Spy",    icon: Search },
  { id: "script", label: "Tạo kịch bản", icon: FileText },
] as const;

export default function Home() {
  const [activeTab, setActiveTab] = useState<"spy" | "script">("spy");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      {/* Header */}
      <header className="bg-white border-b border-slate-200/80 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
              <span className="text-white text-xs font-black">SA</span>
            </div>
            <span className="text-sm font-bold text-slate-700">S-Anh Tools</span>
          </div>
          {/* Tab switcher */}
          <nav className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                  activeTab === id
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === "spy"    && <SpyBoard />}
        {activeTab === "script" && <ScriptGenerator />}
      </main>
    </div>
  );
}
