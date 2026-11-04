import Link from "next/link";
import SendFeedback from "./feedback-dialog";
import { Wordmark } from "./ui";

export function SiteLinks() {
  return <nav aria-label="Help and information" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
    <Link className="link-button" href="/support">Help / Contact</Link>
    <Link className="link-button" href="/privacy">Privacy</Link>
  </nav>;
}

export default function SiteFooter() {
  return <footer className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 border-t border-line px-5 py-6 text-muted sm:px-8 lg:flex-row lg:items-center lg:gap-8">
    <div className="text-fg lg:mr-auto"><Wordmark size="sm" /></div>
    <div>
      <nav aria-label="Help and information" className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <a className="link-button inline-flex min-h-11 items-center" href="https://github.com/Llenoxinn/dfCTF/issues/new/choose">Report a bug</a>
        <a className="link-button inline-flex min-h-11 items-center" href="https://github.com/Llenoxinn/dfCTF/issues/new?template=feature_request.md">Suggest a feature</a>
        <SendFeedback className="link-button inline-flex min-h-11 items-center" />
      </nav>
      <p className="text-xs">For account help or private reports, use <Link className="link-button text-xs" href="/support">Help / Contact</Link>.</p>
    </div>
    <Link className="link-button inline-flex min-h-11 items-center self-start text-xs lg:border-l lg:border-line lg:pl-6" href="/privacy">Privacy</Link>
  </footer>;
}
