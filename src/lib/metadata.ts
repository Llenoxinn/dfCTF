import type { Metadata } from "next";

export const SITE_TITLE = "dfCTF: solve security challenges, capture the flag";
export const SITE_DESCRIPTION = "dfCTF is a capture-the-flag platform by DFC Developers. Solve hands-on security challenges, earn points for every flag, and climb the leaderboard.";

/** Include the complete social fields per page; Next.js merges nested metadata shallowly. */
export function publicPageMetadata(path: string, title: string, description: string): Metadata {
  const image = { url: "/social-card.png", width: 1200, height: 630, alt: "dfCTF by DFC Developers. Solve security challenges. Capture the flag." };
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", locale: "en_US", siteName: "dfCTF", url: path, title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
