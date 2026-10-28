"use client";

import Link from "next/link";
import { Wordmark } from "./ui";

export default function SiteHeader({ home = false, signedIn = false, signIn, createAccount }: {
  home?: boolean;
  signedIn?: boolean;
  signIn?: () => void;
  createAccount?: () => void;
}) {
  const homeHref = signedIn || !home ? "/?view=home" : "/";
  return <header className="sticky top-0 z-30 border-b border-line bg-bg">
    <div className="mx-auto flex min-h-16 w-full max-w-[1440px] flex-wrap items-center gap-x-6 px-5 sm:px-8 lg:flex-nowrap min-[1520px]:border-x min-[1520px]:border-line">
      <a className="brand-link flex h-16 items-center" href={homeHref} aria-label="dfCTF home"><Wordmark /></a>
      <nav aria-label="Sections" className="order-last flex w-full items-center gap-1 overflow-x-auto pb-2 lg:order-none lg:mx-auto lg:w-auto lg:overflow-visible lg:pb-0">
        {[["#leaderboard", "Leaderboard"], ["#this-week", "This week"], ["#categories", "Categories"], ["/resources", "Resources"], ["/rules", "Rules"], ["#faq", "FAQ"]].map(([href, label]) => <Link key={href} href={!home && href.startsWith("#") ? `${homeHref}${href}` : href} className="shrink-0 rounded-xs px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-fg">{label}</Link>)}
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
        {signedIn ? null : signIn ? <button className="button button-ghost max-sm:hidden" onClick={signIn}>Sign in</button> : <a className="button button-ghost max-sm:hidden" href="/?auth=signin">Sign in</a>}
        {createAccount ? <button className="button button-primary" onClick={createAccount}>{signedIn ? "Open challenges" : "Start solving"}</button> : <a className="button button-primary" href="/?auth=signup">Start solving</a>}
      </div>
    </div>
  </header>;
}
