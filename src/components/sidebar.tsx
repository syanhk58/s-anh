"use client";

import { cn } from "@/lib/utils";
import { Search, FileText, Home, Wrench, Megaphone } from "lucide-react";

export type ModuleId = "tim-sp-spy" | "tao-kich-ban" | "dang-bai-page" | "tool-page";

export interface NavItem {
  id: ModuleId;
  label: string;
  icon: React.ElementType;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "tim-sp-spy",    label: "Tìm SP Spy",      icon: Search },
  { id: "tao-kich-ban",  label: "Tạo kịch bản",    icon: FileText },
  { id: "dang-bai-page", label: "Đăng bài Page",   icon: Megaphone },
  { id: "tool-page",     label: "Tool Page",        icon: Wrench },
];

interface SidebarProps {
  activeModule: ModuleId;
  onModuleChange: (id: ModuleId) => void;
}

const FLAGS = ["🇸🇦", "🇦🇪", "🇶🇦", "🇰🇼", "🇧🇭"];

export default function Sidebar({ activeModule, onModuleChange }: SidebarProps) {
  return (
    <aside className="flex flex-col w-[240px] h-screen sticky top-0 bg-[#0f1c4d] text-white select-none shrink-0 overflow-y-auto">
      {/* Back nav */}
      <div className="flex items-center gap-2 px-5 pt-5 pb-4">
        <button className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors text-sm group">
          <Home className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Trang chủ</span>
        </button>
      </div>

      {/* Brand profile */}
      <div className="px-4 pb-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shrink-0">
            <span className="text-white font-black text-sm tracking-tight">Ta</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-base tracking-wide">TALPHA</span>
              <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                Active
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-0.5 truncate">Tiểu Alpha — Middle East</p>
            <div className="flex gap-0.5 mt-1">
              {FLAGS.map((f) => (
                <span key={f} className="text-sm leading-none">{f}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeModule === id;
          return (
            <button
              key={id}
              onClick={() => onModuleChange(id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-150 text-left group",
                isActive
                  ? "bg-blue-600/80 text-white shadow-md shadow-blue-900/40"
                  : "text-slate-300 hover:bg-white/8 hover:text-white"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0 transition-colors",
                isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
              )} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/10">
        <p className="text-blue-400 text-xs font-bold tracking-widest uppercase">V5.2 PREMIUM</p>
        <p className="text-slate-500 text-[11px] mt-0.5">Hệ thống CEO Intelligence</p>
      </div>
    </aside>
  );
}
