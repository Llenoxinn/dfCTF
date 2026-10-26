import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Martian_Mono } from "next/font/google";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const mark = Martian_Mono({ subsets: ["latin"], weight: "800", variable: "--font-mark", display: "swap" });

export const metadata: Metadata = {
  icons: { icon: { url: "/icon.svg", type: "image/svg+xml", sizes: "any" } },
  title: "dfCTF: solve security challenges, capture the flag",
  description: "dfCTF is a capture-the-flag platform by DFC Developers. Solve hands-on security challenges, earn points for every flag, and climb the leaderboard.",
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#101113" }, { media: "(prefers-color-scheme: dark)", color: "#101113" }],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value) ?? "dark";
  return <html lang="en" data-theme={theme} className={`${sans.variable} ${mono.variable} ${mark.variable}`} suppressHydrationWarning><body>{children}</body></html>;
}
