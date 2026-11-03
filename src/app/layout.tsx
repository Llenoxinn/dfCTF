import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Martian_Mono } from "next/font/google";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/metadata";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const mark = Martian_Mono({ subsets: ["latin"], weight: "800", variable: "--font-mark", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "https://dfctf.vercel.app"),
  icons: { icon: { url: "/icon.svg", type: "image/svg+xml", sizes: "any" } },
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#101113" }, { media: "(prefers-color-scheme: dark)", color: "#101113" }],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value) ?? "dark";
  return <html lang="en" data-theme={theme} className={`${sans.variable} ${mono.variable} ${mark.variable}`} suppressHydrationWarning><body>{children}</body></html>;
}
