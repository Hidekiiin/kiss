import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KISS - 音声チャットアプリ",
  description: "虹色パステルカラーの音声チャットアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <div className="container mx-auto px-4 py-8">
          {children}
        </div>
      </body>
    </html>
  );
}
