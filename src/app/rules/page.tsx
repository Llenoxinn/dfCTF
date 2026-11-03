import { publicPageMetadata } from "@/lib/metadata";
import RulesContent from "@/components/rules-content";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";

export const metadata = publicPageMetadata("/rules", "Rules / Mechanics · dfCTF", "Read dfCTF rules for independent solving, allowed tools, safe practice, scoring, and fair play.");

export default function RulesPage() {
  return <div className="rules-page">
    <a className="skip-link" href="#rules-content">Skip to content</a>
    <SiteHeader />
    <main id="rules-content" className="rules-main"><RulesContent /></main>
    <SiteFooter />
  </div>;
}
