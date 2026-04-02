"use client";

import { Construction } from "lucide-react";

interface PlaceholderModuleProps {
  title: string;
  description?: string;
  icon?: React.ElementType;
}

export default function PlaceholderModule({
  title,
  description = "Module này đang được phát triển.",
  icon: Icon = Construction,
}: PlaceholderModuleProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="w-20 h-20 rounded-3xl bg-[#0f1c4d]/10 flex items-center justify-center mb-6 shadow-inner">
        <Icon className="w-10 h-10 text-[#0f1c4d]/40" />
      </div>
      <h2 className="text-2xl font-bold text-slate-700 mb-2">{title}</h2>
      <p className="text-slate-400 text-sm max-w-sm">{description}</p>
      <div className="mt-6 px-4 py-2 bg-blue-50 border border-blue-100 rounded-full text-blue-500 text-xs font-semibold">
        🚧 Đang phát triển
      </div>
    </div>
  );
}
