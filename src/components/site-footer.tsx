import Link from "next/link";

export function SiteLinks() {
  return <nav aria-label="Help and information" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
    <Link className="link-button" href="/support">Help / Contact</Link>
  </nav>;
}

export default function SiteFooter() {
  return <footer className="mx-auto w-full max-w-[1440px] border-t border-line px-5 py-6 text-muted sm:px-8"><SiteLinks /></footer>;
}
