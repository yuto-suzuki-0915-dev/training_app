import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "LOGBOOK | 筋トレ記録",
  description: "ジムでのトレーニングを素早く記録するアプリ",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
