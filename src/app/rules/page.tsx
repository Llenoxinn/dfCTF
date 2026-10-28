import type { Metadata } from "next";
import RulesContent from "@/components/rules-content";
import SiteHeader from "@/components/site-header";

export const metadata: Metadata = { title: "Rules / Mechanics · dfCTF" };

export default function RulesPage() {
  return <div className="rules-page">
    <a className="skip-link" href="#rules-content">Skip to content</a>
    <SiteHeader />
    <main id="rules-content" className="rules-main"><RulesContent /></main>
  </div>;
}
