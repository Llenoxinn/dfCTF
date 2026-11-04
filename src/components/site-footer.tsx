"use client";

import Link from "next/link";
import { useState } from "react";
import type { FeedbackKind } from "@/lib/feedback";
import FeedbackDialog, { emptyFeedbackDraft, type FeedbackDraft } from "./feedback-dialog";
import { Wordmark } from "./ui";

export function SiteLinks() {
  return <nav aria-label="Help and information" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
    <Link className="link-button" href="/support">Help / Contact</Link>
    <Link className="link-button" href="/privacy">Privacy</Link>
  </nav>;
}

export default function SiteFooter() {
  const [report,setReport]=useState<FeedbackKind|null>(null);
  const [drafts,setDrafts]=useState<Record<FeedbackKind,FeedbackDraft>>(()=>({feedback:emptyFeedbackDraft(),bug:emptyFeedbackDraft(),feature:emptyFeedbackDraft()}));
  return <><footer className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 border-t border-line px-5 py-6 text-muted sm:px-8 lg:flex-row lg:items-center lg:gap-8">
    <div className="text-fg lg:mr-auto"><Wordmark size="sm" /></div>
    <div>
      <nav aria-label="Help and information" className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <button type="button" className="link-button inline-flex min-h-11 items-center" onClick={()=>setReport("bug")}>Report a bug</button>
        <button type="button" className="link-button inline-flex min-h-11 items-center" onClick={()=>setReport("feature")}>Suggest a feature</button>
        <button type="button" className="link-button inline-flex min-h-11 items-center" onClick={()=>setReport("feedback")}>Send feedback</button>
      </nav>
      <p className="text-xs">Reports and feedback go privately to the developers. For account help, use <Link className="link-button text-xs" href="/support">Help / Contact</Link>.</p>
    </div>
    <Link className="link-button inline-flex min-h-11 items-center self-start text-xs lg:border-l lg:border-line lg:pl-6" href="/privacy">Privacy</Link>
  </footer>{report?<FeedbackDialog kind={report} draft={drafts[report]} setDraft={update=>setDrafts(current=>({...current,[report]:update(current[report])}))} close={()=>setReport(null)}/>:null}</>;
}
