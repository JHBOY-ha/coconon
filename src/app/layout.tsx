import type { Metadata } from "next";
import { DM_Serif_Display, Manrope } from "next/font/google";
import "./globals.css";
import { initializeApplication } from "@/lib/server/config";
import { ensureScheduler } from "@/lib/server/scheduler";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif-display",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "coconon",
  description: "Analyze your Bilibili watch history and spot information coconon risks.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await initializeApplication();
  await ensureScheduler();

  return (
    <html lang="zh-CN">
      <body className={`${manrope.variable} ${dmSerifDisplay.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
