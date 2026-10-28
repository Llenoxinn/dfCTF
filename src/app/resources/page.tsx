import type { Metadata } from "next";
import Link from "next/link";
import ResourcesContent from "@/components/resources-content";
import { Icon, Wordmark } from "@/components/ui";

export const metadata: Metadata = {
  title: "Tutorials & Resources · dfCTF",
  description: "Get to know the main areas of cybersecurity, understand the basics, and explore tools and optional guided exercises at your own pace.",
};

export default function ResourcesPage() {
  return <div className="resources-page">
    <a className="skip-link" href="#resources-content">Skip to content</a>
    <header className="site-nav rules-nav">
      <Link className="brand-link" href="/?view=home" aria-label="dfCTF home"><Wordmark /></Link>
      <div className="head-actions"><Link className="text-button" href="/?view=home"><Icon name="back" size={16} />Home</Link><Link className="text-button page-cross-link" href="/rules">Rules / Mechanics</Link><Link className="button button-secondary" href="/?view=practice">Open challenges</Link></div>
    </header>
    <main id="resources-content" className="resources-main" tabIndex={-1}><ResourcesContent /></main>
  </div>;
}
