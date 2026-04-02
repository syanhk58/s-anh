import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TALPHA — CEO Intelligence Dashboard",
  description: "Hệ thống quản lý marketing & kinh doanh toàn diện V5.2 PREMIUM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
