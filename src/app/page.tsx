"use client";

import { useState } from "react";
import Sidebar, { ModuleId } from "@/components/sidebar";
import SpyBoard from "@/components/spy-board";
import ScriptGenerator from "@/components/script-generator";
import FacebookToolPage from "@/components/facebook-tool-page";

function ModuleContent({ moduleId }: { moduleId: ModuleId }) {
  switch (moduleId) {
    case "tim-sp-spy":   return <SpyBoard />;
    case "tao-kich-ban": return <ScriptGenerator />;
    case "tool-page":    return <FacebookToolPage />;
    default:             return null;
  }
}

export default function Home() {
  const [activeModule, setActiveModule] = useState<ModuleId>("tim-sp-spy");

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activeModule={activeModule} onModuleChange={setActiveModule} />
      <main className="flex-1 overflow-auto p-6">
        <ModuleContent moduleId={activeModule} />
      </main>
    </div>
  );
}
