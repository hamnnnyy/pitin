import type { Metadata, Viewport } from "next";
import { Barlow_Condensed } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
});

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "700"],
  style: ["normal", "italic"],
  variable: "--font-barlow",
});

export const metadata: Metadata = {
  title: "PITIN",
  description: "공부를 레이스로",
};

export const viewport: Viewport = {
  themeColor: "#090a0c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${pretendard.variable} ${barlow.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
