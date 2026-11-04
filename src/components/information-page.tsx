import type { ReactNode } from "react";
import SiteHeader from "./site-header";
import SiteFooter from "./site-footer";

export default function InformationPage({ title, introduction, children }: { title: string; introduction: string; children: ReactNode }) {
  return <div className="app">
    <a className="skip-link" href="#information-content">Skip to content</a>
    <SiteHeader />
    <main id="information-content" className="rules-main" tabIndex={-1}>
      <div className="page-head"><div><h1>{title}</h1><p>{introduction}</p></div></div>
      <article className="rules-copy">{children}</article>
    </main>
    <SiteFooter />
  </div>;
}
