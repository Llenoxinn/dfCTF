"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Wordmark } from "./ui";

export default function SiteHeader({ home = false, signedIn = false, signIn, createAccount, openPage }: {
  home?: boolean;
  signedIn?: boolean;
  signIn?: () => void;
  createAccount?: () => void;
  openPage?: (view: "resources" | "rules") => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const header = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => { if (!header.current?.contains(event.target as Node)) setMenuOpen(false); };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menuOpen]);
  const homeHref = signedIn || !home ? "/?view=home" : "/";
  const start = (className: string) => createAccount ? <button className={className} onClick={() => { setMenuOpen(false); createAccount(); }}>{signedIn ? "Open challenges" : "Start solving"}</button> : <a className={className} href="/?auth=signup">Start solving</a>;
  return <header ref={header} className="sticky top-0 z-30 border-b border-line bg-bg" onKeyDown={event => {
    if (event.key === "Escape" && menuOpen) { setMenuOpen(false); menuButton.current?.focus(); }
  }}>
    <div className="mx-auto flex min-h-16 w-full max-w-[1440px] flex-wrap items-center gap-x-6 px-5 sm:px-8 lg:flex-nowrap min-[1520px]:border-x min-[1520px]:border-line">
      <a className="brand-link flex h-16 items-center" href={homeHref} aria-label="dfCTF home"><Wordmark /></a>
      <nav id={menuId} aria-label="Sections" className={`${menuOpen ? "grid" : "hidden"} order-last w-full grid-cols-2 items-center gap-1 border-t border-line py-3 lg:order-none lg:mx-auto lg:flex lg:w-auto lg:border-0 lg:py-0`}>
        {[["#leaderboard", "Leaderboard"], ["#this-week", "This week"], ["#categories", "Categories"], ["/resources", "Resources"], ["/rules", "Rules"], ["#faq", "FAQ"]].map(([href, label]) => <Link key={href} href={!home && href.startsWith("#") ? `${homeHref}${href}` : href} onClick={event => {
          setMenuOpen(false);
          if (!openPage || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (href !== "/resources" && href !== "/rules")) return;
          event.preventDefault(); openPage(href === "/resources" ? "resources" : "rules");
        }} className="flex min-h-11 items-center rounded-xs px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-fg">{label}</Link>)}
        <div className="col-span-2 pt-2 sm:hidden">{start("button button-primary w-full")}</div>
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
        {signedIn ? null : signIn ? <button className="button button-ghost" onClick={signIn}>Sign in</button> : <a className="button button-ghost" href="/?auth=signin">Sign in</a>}
        {start("button button-primary hidden sm:inline-flex")}
        <button ref={menuButton} type="button" className="button button-secondary min-h-11 lg:hidden" aria-expanded={menuOpen} aria-controls={menuId} onClick={() => setMenuOpen(open => !open)}>{menuOpen ? "Close" : "Menu"}</button>
      </div>
    </div>
  </header>;
}
