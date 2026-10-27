import type { Metadata } from "next";
import Link from "next/link";
import RulesContent from "@/components/rules-content";
import { Wordmark } from "@/components/ui";

export const metadata: Metadata = { title: "Rules / Mechanics · dfCTF" };

export default function RulesPage() {
  return <div className="rules-page">
    <a className="skip-link" href="#rules-content">Skip to content</a>
    <header className="site-nav rules-nav">
      <Link className="brand-link" href="/?view=home" aria-label="dfCTF home"><Wordmark /></Link>
      <Link className="button button-secondary" href="/?view=practice">Open challenges</Link>
    </header>
    <main id="rules-content" className="rules-main"><RulesContent /></main>
  </div>;
}
