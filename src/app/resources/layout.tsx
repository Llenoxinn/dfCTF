import type { ReactNode } from "react";
import SiteHeader from "@/components/site-header";

export default function ResourcesLayout({ children }: { children: ReactNode }) {
  return <div className="resources-page">
    <a className="skip-link" href="#resources-content">Skip to content</a>
    <SiteHeader />
    <main id="resources-content" className="resources-main" tabIndex={-1}>{children}</main>
  </div>;
}
