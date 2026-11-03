import type { Metadata } from "next";

export const SITE_TITLE = "dfCTF: solve security challenges, capture the flag";
export const SITE_DESCRIPTION = "dfCTF is a capture-the-flag platform by DFC Developers. Solve hands-on security challenges, earn points for every flag, and climb the leaderboard.";

/** Include the complete social fields per page; Next.js merges nested metadata shallowly. */
export function publicPageMetadata(path: string, title: string, description: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", locale: "en_US", siteName: "dfCTF", url: path, title, description },
    twitter: { card: "summary", title, description },
  };
}
