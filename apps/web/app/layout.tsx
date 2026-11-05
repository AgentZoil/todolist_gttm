import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Theo dõi nhiệm vụ",
  description:
    "Hệ thống quản lý, theo dõi và đánh giá nhiệm vụ của CỤC ĐƯỜNG BỘ VIỆT NAM",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
