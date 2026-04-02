import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "S-Anh Tools — Spy & Script Generator",
  description: "Tìm SP Spy + Tạo kịch bản chào hàng AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="bg-slate-50 min-h-screen">{children}</body>
    </html>
  );
}
