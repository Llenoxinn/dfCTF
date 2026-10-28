"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { ResourceGuide, ResourceTool } from "@/lib/resources";
import { READING_SECTIONS, TOPIC_INFO } from "@/lib/resource-learning";
import { LESSON_PLANS } from "@/lib/resource-lesson-plan";
import { Icon } from "./ui";
import GlossaryText from "./resource-glossary";
import { LearningProgressNotice, useResourceProgress } from "./resource-progress";
import LineSidebar, { PAGE_INDEX } from "./line-sidebar";

const Disclosure = () => <span className="resource-disclosure mono" aria-hidden="true"><span>[+]</span><span>[-]</span></span>;

function ToolGuide({ tool, open, bookmarks, bookmark }: { tool: ResourceTool; open: string[]; bookmarks: string[]; bookmark: (toolId: string) => void }) {
  return <details className="resource-tool" id={tool.id} open={open.includes(tool.id)}>
    <summary><h4><span>{tool.name}</span><span className="resource-platform">{tool.platform}</span><Disclosure /></h4></summary>
    <div className="resource-tool-copy">
      <button type="button" className="text-button resource-bookmark-tool" aria-label={`Bookmark ${tool.name}`} aria-pressed={bookmarks.includes(tool.id)} onClick={() => bookmark(tool.id)}>{bookmarks.includes(tool.id) ? "Tool bookmarked" : "Bookmark this tool"}</button>
      <p><GlossaryText text={tool.when} /></p>
      <details className="resource-exercise" id={`${tool.id}-exercise`} open={open.includes(`${tool.id}-exercise`)}>
        <summary>Try a guided exercise<Disclosure /></summary>
        <div className="resource-exercise-copy">
          <ol>{tool.steps.map(step => <li key={step}><GlossaryText text={step} /></li>)}</ol>
          {tool.example ? <figure className="resource-example"><figcaption>{tool.example.label}</figcaption><pre tabIndex={0} aria-label={tool.example.label}><code>{tool.example.code}</code></pre></figure> : null}
          <div className="resource-takeaway"><h5>What you might notice</h5><p><GlossaryText text={tool.observe} /></p></div>
          <div className="resource-pitfall"><h5>Keep in mind</h5><p><GlossaryText text={tool.pitfall} /></p></div>
        </div>
      </details>
      <ul className="resource-links" aria-label={`${tool.name} references`}>{tool.links.map(link => <li key={link.href}><a href={link.href}>{link.label}<Icon name="chevron" size={14} /></a></li>)}</ul>
    </div>
  </details>;
}

type Neighbor = { id: string; title: string };
type Path = { id: string; title: string; position: number; total: number };

export default function ResourceReader({ guide, previous, next, path, prerequisites }: { guide: ResourceGuide; previous?: Neighbor; next?: Neighbor; path?: Path; prerequisites: Neighbor[] }) {
  const { progress, setProgress, ready } = useResourceProgress();
  const reader = useRef<HTMLDivElement>(null);
  const open = progress.open[guide.id] ?? [];
  const furtherTools = [...guide.tools.slice(1), ...guide.deeper];
  const topicInfo = TOPIC_INFO[guide.id];
  const lesson = LESSON_PLANS[guide.id];
  const sectionId = (part: string) => `${guide.id}-${part}`;
  const bookmark = (toolId?: string) => {
    const key = toolId ? `${guide.id}/${toolId}` : guide.id;
    setProgress(current => ({ ...current, bookmarks: current.bookmarks.includes(key) ? current.bookmarks.filter(value => value !== key) : [...current.bookmarks, key] }));
  };
  const syncDisclosures = () => {
    if (!ready || !reader.current) return;
    const ids = [...reader.current.querySelectorAll<HTMLDetailsElement>("details[id][open]")].map(details => details.id);
    setProgress(current => (current.open[guide.id] ?? []).join() === ids.join() ? current : { ...current, open: { ...current.open, [guide.id]: ids } });
  };
  useEffect(() => {
    const node = reader.current;
    if (!ready || !node) return;
    // Native toggle events do not bubble; capture nested disclosure changes.
    node.addEventListener("toggle", syncDisclosures, true);
    return () => node.removeEventListener("toggle", syncDisclosures, true);
  }, [ready, guide.id]);
  const reveal = (id: string) => {
    const extra = furtherTools.some(tool => tool.id === id) ? [sectionId("deeper"), id] : [id];
    setProgress(current => ({ ...current, open: { ...current.open, [guide.id]: [...new Set([...(current.open[guide.id] ?? []), ...extra])] } }));
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "instant" }));
  };

  useEffect(() => {
    if (!ready || !reader.current) return;
    const saved = progress.last?.topic === guide.id ? progress.last.section : sectionId("overview");
    const requested = window.location.hash.slice(1) || saved;
    const target = document.getElementById(requested);
    const destination = target && reader.current.contains(target) ? target : document.getElementById(sectionId("overview"));
    const ancestors: string[] = [];
    let ancestor = destination?.closest("details");
    while (ancestor && reader.current.contains(ancestor)) {
      ancestors.push(ancestor.id);
      ancestor = ancestor.parentElement?.closest("details") ?? null;
    }
    setProgress(current => ({ ...current, last: { topic: guide.id, section: destination?.closest("section")?.id ?? sectionId("overview"), ...(path ? { path: path.id } : {}) }, open: { ...current.open, [guide.id]: [...new Set([...(current.open[guide.id] ?? []), ...ancestors])] } }));
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible) return;
      setProgress(current => current.last?.topic === guide.id && current.last.section === visible.target.id ? current : { ...current, last: { topic: guide.id, section: visible.target.id, ...(path ? { path: path.id } : {}) } });
    }, { rootMargin: "-128px 0px -50% 0px" });
    const frame = requestAnimationFrame(() => {
      if (window.location.hash || saved !== sectionId("overview")) destination?.scrollIntoView({ behavior: "instant" });
      reader.current?.querySelectorAll("section[data-reading-section]").forEach(section => observer.observe(section));
    });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
    // Restore once per topic; later progress updates must not pull the reader back.
  }, [ready, guide.id]);

  const toolProps = { open, bookmarks: progress.bookmarks.filter(key => key.startsWith(`${guide.id}/`)).map(key => key.slice(guide.id.length + 1)), bookmark };
  const topicHref = (topic: Neighbor) => `/resources/${topic.id}${path ? `?path=${path.id}` : ""}`;
  const practiceHref = `/?${new URLSearchParams({ view: "practice", category: topicInfo.category, difficulty: "Easy" })}`;

  return <div ref={reader} className="resource-reader">
    <nav aria-label="Learning breadcrumbs" className="resource-breadcrumbs"><Link href="/resources">All resources</Link><span aria-hidden="true">/</span>{path ? <><Link href={`/resources#learning-path-${path.id}`}>{path.title}</Link><span aria-hidden="true">/</span></> : null}<span>{guide.title}{path ? <span className="fine">, topic {path.position} of {path.total}</span> : null}</span></nav>
    <section id={sectionId("overview")} className="resources-heading" data-reading-section>
      <h1>{guide.title}</h1><p><GlossaryText text={guide.summary} /></p>
      <p className="resource-reader-intro">Read the introduction and basics first. Open tools and optional exercises whenever you feel ready. Underlined terms explain themselves when clicked.</p>
    </section>
    <section className={`resource-learning-plan${prerequisites.length ? "" : " is-single"}`} aria-labelledby="learning-goals-title">
      <div><h2 id="learning-goals-title">What you’ll learn</h2><ul>{lesson.goals.map(goal => <li key={goal}>{goal}</li>)}</ul>{prerequisites.length ? null : <p className="resource-plan-note">Starting level: {topicInfo.level.toLowerCase()}. No previous topics needed.</p>}</div>
      {prerequisites.length ? <div><h3>Before you start</h3><p>Starting level: {topicInfo.level.toLowerCase()}. These topics can help you feel prepared, in any order.</p><ul>{prerequisites.map(topic => <li key={topic.id}><Link className="resource-topic-link" href={`/resources/${topic.id}`}>{topic.title}<span className="resource-link-arrow" aria-hidden="true">→</span></Link></li>)}</ul></div> : null}
    </section>
    <div className="resource-reader-actions">
      <button type="button" className="button button-secondary" disabled={!ready} aria-pressed={progress.bookmarks.includes(guide.id)} onClick={() => bookmark()}>{progress.bookmarks.includes(guide.id) ? "Topic bookmarked" : "Bookmark topic"}</button>
      <LearningProgressNotice />
    </div>
    <div className="resources-layout">
      <LineSidebar className="resources-index" label="Topic sections" items={READING_SECTIONS.map(([id, label]) => ({ label, href: `#${sectionId(id)}` }))} spy {...PAGE_INDEX} />
      <div className="resources-copy">
        <section id={sectionId("basics")} data-reading-section tabIndex={-1}>
          <h2>Start with the basics</h2><dl className="resource-area-notes" aria-label={`${guide.title} core concepts`}>{guide.concepts.map(concept => <div key={concept.title}><dt>{concept.title}</dt><dd><GlossaryText text={concept.detail} /></dd></div>)}</dl>
        </section>
        <section id={sectionId("first-steps")} data-reading-section tabIndex={-1}>
          <h2>Your first steps</h2><p>Start with one approachable tool. Read what it does before deciding whether to try its exercise.</p>
          <div className="resource-tools"><ToolGuide tool={guide.tools[0]} {...toolProps} /></div>
          <details className="resources-setup" id={sectionId("setup")} open={open.includes(sectionId("setup"))}><summary>Before your first exercise<Disclosure /></summary><div className="resources-setup-copy"><ol className="resources-path"><li>Make a practice folder and work on copies of supplied or self-created files.</li><li>Check the tool's platform and official installation instructions before running commands.</li><li>Record the original file's hash and keep notes about each change and observation.</li><li>Use an isolated virtual machine for unfamiliar executables. Keep private files and credentials outside the lab.</li></ol><p>PowerShell examples run in PowerShell; Python examples need Python 3. Linux-only examples can use an appropriate lab or <a href="https://learn.microsoft.com/en-us/windows/wsl/install">Microsoft's WSL setup guide</a>.</p></div></details>
        </section>
        <section id={sectionId("tools")} data-reading-section tabIndex={-1}>
          <h2>Tools to explore next</h2><p>Choose a tool by the question it helps answer. You do not need to install them all.</p>
          <ul className="resource-recommendations" aria-label={`${guide.title} tool recommendations`}>{furtherTools.map(tool => <li key={tool.id}><strong><a href={`#${tool.id}`} onClick={() => reveal(tool.id)}>{tool.name}</a></strong><p><GlossaryText text={tool.when} /></p></li>)}</ul>
        </section>
        <section id={sectionId("depth")} data-reading-section tabIndex={-1}>
          <h2>Go deeper</h2><p>Explore a more detailed workflow when a question catches your interest. Exercises stay optional.</p>
          <details className="resource-deep-dive" id={sectionId("deeper")} open={open.includes(sectionId("deeper"))}>
            <summary><span><strong>Further guides in {guide.title}</strong><span className="resource-deep-preview">{furtherTools.length} tools with optional exercises.</span></span><Disclosure /></summary>
            <div className="resource-deep-content"><div className="resource-tools">{furtherTools.map(tool => <ToolGuide key={tool.id} tool={tool} {...toolProps} />)}</div></div>
          </details>
        </section>
        <section id={sectionId("recap")} data-reading-section tabIndex={-1}><h2>Key takeaways</h2><ul className="resource-recap">{lesson.recap.map(item => <li key={item}><GlossaryText text={item} /></li>)}</ul></section>
        <section className="resources-scope" id={sectionId("practice")} data-reading-section tabIndex={-1}>
          <h2>Optional practice</h2><p>{topicInfo.practice}</p><p>When you feel ready, browse easy challenges in <strong>{topicInfo.category}</strong>. These are category recommendations; the available challenges may cover different skills. Sign in to solve challenges, or keep using the exercises above without an account.</p>
          <div className="resources-actions"><a className="button button-primary" href={practiceHref}>Browse easy {topicInfo.category} challenges</a><a className="text-button" href="/rules">Rules / Mechanics</a></div>
          <p className="resource-save-note">Use only supplied files and explicitly authorized targets. dfCTF infrastructure is not a practice target. Solve challenges independently; these guides do not provide their answers.</p>
        </section>
        <div className="resource-finish">
          <p>{progress.completed.includes(guide.id) ? `${guide.title} is marked read on every learning path that includes it.` : `Done with ${guide.title}? Mark it read and it fills in on your learning paths.`}</p>
          <button type="button" className="button button-secondary" disabled={!ready} aria-pressed={progress.completed.includes(guide.id)} onClick={() => setProgress(current => ({ ...current, completed: current.completed.includes(guide.id) ? current.completed.filter(id => id !== guide.id) : [...current.completed, guide.id] }))}>{progress.completed.includes(guide.id) ? "Marked read" : "Mark topic read"}</button>
        </div>
        <nav className="resource-neighbors" aria-label={path ? `${path.title} topic navigation` : "Topic navigation"}>
          {previous ? <Link href={topicHref(previous)}><span className="fine">Previous topic</span><strong>{previous.title}</strong></Link> : <Link href="/resources"><span className="fine">Back to</span><strong>All resources</strong></Link>}
          {next ? <Link href={topicHref(next)}><span className="fine">Next topic</span><strong>{next.title}</strong></Link> : <Link href="/resources#learning-paths"><span className="fine">Finished this path?</span><strong>Choose another learning path</strong></Link>}
        </nav>
      </div>
    </div>
  </div>;
}
