"use client";

import { useState } from "react";
import Sidebar, { ModuleId } from "@/components/sidebar";
import SpyBoard from "@/components/spy-board";
import ScriptGenerator from "@/components/script-generator";
import FacebookToolPage from "@/components/facebook-tool-page";
import PagePostTool from "@/components/page-post-tool";
import VideoCreator from "@/components/video-creator";
import VideoRemixer from "@/components/video-remixer";
import VirtualTryOn from "@/components/virtual-tryon";
import FashionVideo from "@/components/fashion-video";

function ModuleContent({ moduleId }: { moduleId: ModuleId }) {
  switch (moduleId) {
    case "tim-sp-spy":     return <SpyBoard />;
    case "tao-kich-ban":   return <ScriptGenerator />;
    case "dang-bai-page":  return <PagePostTool />;
    case "tool-page":      return <FacebookToolPage />;
    case "tao-video":      return <VideoCreator />;
    case "xoa-logo":       return <VideoRemixer />;
    case "thu-do-ai":      return <VirtualTryOn />;
    case "video-thoi-trang": return <FashionVideo />;
    default:               return null;
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
