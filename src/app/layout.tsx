import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next } from "next/font/google";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import "./globals.css";

const sans = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = Atkinson_Hyperlegible_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "dfCTF · Learn security by solving cases",
  description: "A private capture-the-flag practice platform. Download fictional evidence, work it on your own machine, and submit the flag.",
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f3f4fa" }, { media: "(prefers-color-scheme: dark)", color: "#080a1f" }],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return <html lang="en" data-theme={theme ?? undefined} className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning><body>{children}</body></html>;
}
