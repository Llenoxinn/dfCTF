"use client";

import { useEffect } from "react";

/** Every guide starts closed. When a link or the address points at one, open it (and the Go deeper list around it) and bring it into view. */
export default function GuideOpener() {
  useEffect(() => {
    function open(id: string) {
      const target = id ? document.getElementById(id) : null;
      if (!(target instanceof HTMLDetailsElement)) return;
      for (let el: HTMLDetailsElement | null = target; el; el = el.parentElement?.closest("details") ?? null) el.open = true;
      target.scrollIntoView();
      target.querySelector("summary")?.focus({ preventScroll: true });
    }
    const fromHash = () => open(decodeURIComponent(window.location.hash.slice(1)));
    // Also catch a click on a link to the guide already in the address, which fires no hashchange.
    const fromClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
      if (link) open(decodeURIComponent(link.getAttribute("href")!.slice(1)));
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    document.addEventListener("click", fromClick);
    return () => { window.removeEventListener("hashchange", fromHash); document.removeEventListener("click", fromClick); };
  }, []);
  return null;
}
