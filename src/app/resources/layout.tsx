import type { ReactNode } from "react";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { headers } from "next/headers";
import { learningIdentity } from "@/server/learning-progress";
import { LearningProgressProvider } from "@/components/resource-progress";

export default async function ResourcesLayout({ children }: { children: ReactNode }) {
  const userId = await learningIdentity(new Headers(await headers()));
  return <LearningProgressProvider key={userId ?? "guest"} userId={userId}><div className="resources-page">
    <a className="skip-link" href="#resources-content">Skip to content</a>
    <SiteHeader />
    <main id="resources-content" className="resources-main" tabIndex={-1}>{children}</main>
    <SiteFooter />
  </div></LearningProgressProvider>;
}
