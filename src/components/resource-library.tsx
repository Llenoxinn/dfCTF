"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LEARNING_PATHS, READING_SECTIONS, TOPIC_INFO, matchingTools, type ResourceCard } from "@/lib/resource-learning";
import { heatCellPath } from "@/lib/pixel";
import { LearningProgressNotice, useResourceProgress } from "./resource-progress";
import { Icon, Meter, Pips } from "./ui";

type StopState = "read" | "current" | "next" | "";
type Stop = { key: string; label: string; href: string; state: StopState };
const STATUS: Record<StopState, string> = { read: "Read", current: "Reading", next: "Up next", "": "" };

/** A stop is the heatmap's 8x8 dithered square: outlined to begin with, half-dense yellow while you read it, solid once read. */
function RouteNode({ state }: { state: StopState }) {
  const level = state === "read" ? 4 : state === "current" ? 2 : 0;
  return <svg className="route-node" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges">
    <path d="M.5 .5h15v15H.5z" className="route-node-edge" />{level ? <path d={heatCellPath(level, 0, 0, 16)} className="route-node-fill" /> : null}
  </svg>;
}

/** A run of topics or sections joined by one track; the track turns ink where you have already read. */
function Route({ stops, label, className = "", linkClass = "" }: { stops: Stop[]; label: string; className?: string; linkClass?: string }) {
  return <ol className={`route ${className}`} aria-label={label}>{stops.map(stop => <li key={stop.key} className={stop.state ? `is-${stop.state}` : undefined}>
    <Link className={`route-stop ${linkClass}`} href={stop.href} aria-current={stop.state === "current" ? "step" : undefined}>
      <RouteNode state={stop.state} /><span className="route-label">{stop.label}</span>
      {stop.state ? <span className="route-status">{STATUS[stop.state]}</span> : null}
    </Link>
  </li>)}</ol>;
}

// Starting levels borrow the challenge difficulty pips: one green bar for beginner, two orange for intermediate.
const LEVELS = [
  { level: "Beginner", pips: "Easy", note: "No experience needed. Any of these makes a good first topic." },
  { level: "Intermediate", pips: "Medium", note: "Easier after a beginner topic or two. Each page lists what helps first." },
] as const;

const preview = (names: string[]) => names.length > 2 ? `${names[0]}, ${names[1]} and ${names.length - 2} more` : names.join(" and ");

export default function ResourceLibrary({ guides }: { guides: ResourceCard[] }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("");
  const [platform, setPlatform] = useState("");
  const { progress, setProgress, ready } = useResourceProgress();
  useEffect(() => {
    const redirectLegacyLink = () => {
      const hash = window.location.hash.slice(1);
      const topic = guides.find(guide => guide.id === hash || `${guide.id}-deeper` === hash || guide.tools.some(tool => tool.id === hash));
      if (topic) window.location.replace(`/resources/${topic.id}${hash === topic.id ? "" : `#${hash}`}`);
    };
    redirectLegacyLink();
    window.addEventListener("hashchange", redirectLegacyLink);
    return () => window.removeEventListener("hashchange", redirectLegacyLink);
  }, [guides]);
  const filtered = guides.filter(guide => (!level || TOPIC_INFO[guide.id].level === level) && matchingTools(guide, query, platform).length);
  const titleOf = (id: string) => guides.find(guide => guide.id === id)?.title ?? id;
  const read = (id: string) => progress.completed.includes(id);
  const last = ready ? guides.find(guide => guide.id === progress.last?.topic) : undefined;
  const clear = () => { setQuery(""); setLevel(""); setPlatform(""); };
  const bookmark = (id: string) => setProgress(current => ({ ...current, bookmarks: current.bookmarks.includes(id) ? current.bookmarks.filter(key => key !== id) : [...current.bookmarks, id] }));

  // A path lights the topic you are reading; otherwise, once started, its first unread topic.
  const pathStops = (path: (typeof LEARNING_PATHS)[number]) => {
    const current = last && path.topics.includes(last.id) && !read(last.id) ? last.id : undefined;
    const next = current ?? (path.topics.some(read) ? path.topics.find(id => !read(id)) : undefined);
    return path.topics.map((id): Stop => ({ key: id, label: titleOf(id), href: `/resources/${id}?path=${path.id}`, state: read(id) ? "read" : id === current ? "current" : id === next ? "next" : "" }));
  };
  const foundations = LEARNING_PATHS[0];
  const resume = last && progress.last ? (() => {
    const at = READING_SECTIONS.findIndex(([id]) => `${last.id}-${id}` === progress.last!.section);
    const path = LEARNING_PATHS.find(path => path.id === progress.last!.path);
    return { at, path, href: `/resources/${last.id}${path ? `?path=${path.id}` : ""}#${progress.last.section}` };
  })() : undefined;
  const hasSaved = ready && (!!last || progress.bookmarks.length > 0 || progress.completed.length > 0);
  const bookmarks = progress.bookmarks.flatMap(key => {
    const [topicId, toolId] = key.split("/");
    const topic = guides.find(guide => guide.id === topicId);
    const tool = topic?.tools.find(tool => tool.id === toolId);
    return topic && (!toolId || tool) ? [{ key, topic, tool }] : [];
  });

  const saved = <section className="resource-saved" aria-labelledby="your-learning-title">
    <h2 id="your-learning-title">Your learning</h2>
    <div className={`resource-learning-box${last ? " is-current" : ""}`}>
    {last && resume ? <div className="resource-feature resource-continue">
      <div className="resource-feature-copy">
        <h3>{last.title}</h3>
        <p className="resource-continue-summary">{last.summary}</p>
        <p>{resume.at >= 0 ? <>You stopped at <strong>{READING_SECTIONS[resume.at][1]}</strong>, section {resume.at + 1} of {READING_SECTIONS.length}.</> : "Pick up where you left off."}</p>
        {resume.at >= 0 ? <Meter value={resume.at + 1} max={READING_SECTIONS.length} cells={READING_SECTIONS.length} tone="accent" label={`Section ${resume.at + 1} of ${READING_SECTIONS.length}`} /> : null}
        <div className="resource-start-actions"><Link className="button button-primary" href={resume.href} aria-label={`Continue reading: ${last.title}`}>Continue reading</Link><a className="text-button" href="#learning-paths">Explore learning paths</a></div>
      </div>
      <div className="resource-feature-side">
        {resume.path ? <><h4>{resume.path.title}</h4><p className="fine">Topic {resume.path.topics.indexOf(last.id) + 1} of {resume.path.topics.length} on this path</p><Route stops={pathStops(resume.path)} label={`${resume.path.title} progress`} /></>
          : <><h4>In this topic</h4><p className="fine">{READING_SECTIONS.length} sections</p><Route stops={READING_SECTIONS.map(([id, label], i): Stop => ({ key: id, label, href: `/resources/${last.id}#${last.id}-${id}`, state: i === resume.at ? "current" : "" }))} label={`${last.title} sections`} /></>}
      </div>
    </div> : null}
    <div className="resource-learning-stats">
      <div>
        <h3>Topics read</h3>
        <p className="resource-saved-count"><strong>{progress.completed.length}</strong> of {guides.length} topics marked read</p>
        <Meter value={progress.completed.length} max={guides.length} cells={guides.length} label="Topics marked read" />
      </div>
      <div>
        <h3>Bookmarks</h3>
        <p className="resource-saved-count"><strong>{bookmarks.length}</strong> {bookmarks.length === 1 ? "bookmark" : "bookmarks"}</p>
        {bookmarks.length ? <ul className="resource-bookmarks">{bookmarks.map(({ key, topic, tool }) => {
          const label = tool ? `${tool.name} in ${topic.title}` : topic.title;
          return <li key={key}>
            <span className="resource-bookmark-icon" aria-hidden="true"><Icon name="bookmark" size={16} /></span>
            <Link href={`/resources/${topic.id}${tool ? `#${tool.id}` : ""}`}>{tool ? <>{tool.name}<span className="resource-bookmark-topic"> in {topic.title}</span></> : topic.title}</Link>
            <button type="button" className="icon-button resource-bookmark-remove" onClick={() => bookmark(key)} aria-label={`Remove bookmark: ${label}`} title="Remove bookmark"><Icon name="close" size={16} /></button>
          </li>;
        })}</ul> : <p className="fine">Use the bookmark on a topic or a tool to keep it here.</p>}
      </div>
      <div><h3>Saved progress</h3><LearningProgressNotice /></div>
    </div>
    </div>
  </section>;

  return <div className="resource-library">
    <div className="resources-heading">
      <h1>Tutorials &amp; Resources</h1>
      <p>Get the big picture, learn a first skill, then explore tools and deeper guides. Pick one topic or follow a learning path. Practice is there when you feel ready.</p>
    </div>

    {last ? null : <section className="resource-feature resource-welcome" aria-labelledby="start-reading-title">
      <div className="resource-feature-copy">
        <h2 id="start-reading-title">Start with the big picture</h2>
        <p>Cybersecurity covers understanding systems, investigating evidence, and protecting people and information. You do not need to learn it all at once.</p>
        <p>Each topic goes from an introduction to the basics, a first skill, useful tools, and more depth. Click an underlined technical term for a plain-language explanation.</p>
        <div className="resource-start-actions"><Link className="button button-primary" href={`/resources/${foundations.topics[0]}?path=${foundations.id}`}>Start with the foundations</Link><a className="text-button" href="#learning-paths">Explore learning paths</a></div>
        {hasSaved ? null : <LearningProgressNotice />}
      </div>
      <div className="resource-feature-side">
        <h3>{foundations.title}</h3><p className="fine">{foundations.summary}</p>
        <Route stops={pathStops(foundations)} label={`${foundations.title} preview`} />
      </div>
    </section>}
    {hasSaved ? saved : null}

    <section aria-labelledby="browse-topics-title" className="resource-browse">
      <div className="resource-section-head"><h2 id="browse-topics-title">Find your next topic</h2><p>Search by a tool you have heard of, or narrow the list by starting level and platform.</p></div>
      <div className="resource-filters" role="search" aria-label="Search resources">
        <label className="field"><span>Search topics or tools</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setQuery(""); }} placeholder="Try PowerShell, audio, or metadata" /></label>
        <label className="field"><span>Starting level</span><select value={level} onChange={event => setLevel(event.target.value)}><option value="">All levels</option><option>Beginner</option><option>Intermediate</option></select></label>
        <label className="field"><span>Platform</span><select value={platform} onChange={event => setPlatform(event.target.value)}><option value="">All platforms</option>{["Windows", "macOS", "Linux", "Browser"].map(value => <option key={value}>{value}</option>)}</select></label>
      </div>
      <div className="resource-section-bar"><p aria-live="polite">{filtered.length} of {guides.length} topics{query || level || platform ? " match" : ""}</p>{query || level || platform ? <button type="button" className="text-button" onClick={clear}>Clear filters</button> : null}</div>
      {filtered.length ? LEVELS.map(({ level: group, pips, note }) => {
        const shown = filtered.filter(guide => TOPIC_INFO[guide.id].level === group);
        return shown.length ? <div className="resource-level-group" key={group} role="group" aria-labelledby={`level-${group}`}>
          <div className="resource-level-head"><h3 id={`level-${group}`}><Pips value={pips} />{group}</h3><span className="fine">{shown.length} {shown.length === 1 ? "topic" : "topics"}</span><p>{note}</p></div>
          <div className="resource-topic-grid">{shown.map(guide => {
        const tools = matchingTools(guide, query, platform);
        const isSaved = progress.bookmarks.includes(guide.id);
        return <article className="resource-topic-card" key={guide.id}>
          <h4><Link className="resource-topic-link" href={`/resources/${guide.id}`}>{guide.title}<span className="resource-link-arrow" aria-hidden="true">→</span></Link></h4>
          <p>{guide.summary}</p>
          {query || platform ? <ul className="resource-matches" aria-label={`${guide.title} matching tools`}>{tools.map(tool => <li key={tool.id}><Link href={`/resources/${guide.id}#${tool.id}`}>{tool.name}</Link><span>{tool.platform}</span></li>)}</ul>
            : <p className="resource-tool-preview">Tools: {preview(tools.map(tool => tool.name))}</p>}
          {read(guide.id) ? <div className="resource-card-meta"><span className="resource-card-read">Read</span></div> : null}
          <button type="button" className="icon-button resource-card-bookmark" disabled={!ready} aria-pressed={isSaved} aria-label={`Bookmark ${guide.title}`} title={isSaved ? "Remove bookmark" : "Bookmark topic"} onClick={event => {
            bookmark(guide.id);
            const icon = event.currentTarget.querySelector("svg");
            icon?.getAnimations().forEach(animation => animation.cancel());
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
            icon?.animate({ transform: ["none", "translateY(-2px) scale(1.18, 1.3)", "scale(.94, .92)", "none"] }, { duration: 360, easing: "ease-out" });
          }}><Icon name="bookmark" size={18} /></button>
        </article>;
      })}</div>
        </div> : null;
      }) : <div className="resource-empty"><h3>No topics match yet</h3><p>Try a shorter search or choose another level or platform.</p><button type="button" className="button button-secondary" onClick={clear}>Show all topics</button></div>}
    </section>

    <section id="learning-paths" className="resource-paths" aria-labelledby="learning-paths-title">
      <div className="resource-section-head"><h2 id="learning-paths-title">Learning paths</h2><p>Each path is a suggested order of topics. Start at the beginning or open any topic along the way. A topic you mark read fills in on every path that includes it.</p></div>
      <div className="learning-map">{LEARNING_PATHS.map(path => {
        const stops = pathStops(path);
        const done = stops.filter(stop => stop.state === "read").length;
        const target = stops.find(stop => stop.state === "current" || stop.state === "next") ?? stops[0];
        const action = done === stops.length ? "Review path" : target.state ? "Continue path" : "Start path";
        const active = !!last && progress.last?.path === path.id;
        return <article className={`learning-map-lane${active ? " is-active" : ""}`} id={`learning-path-${path.id}`} key={path.id} aria-labelledby={`learning-path-${path.id}-title`}>
          <header className="learning-map-heading">
            <h3 id={`learning-path-${path.id}-title`}>{path.title}</h3><p>{path.summary}</p>
            <div className="learning-map-meta">
              <span className="learning-map-count"><Meter value={done} max={stops.length} cells={stops.length} label={`${done} of ${stops.length} topics read`} /><span className="fine" aria-hidden="true">{done} of {stops.length} read</span>{active ? <span className="sr-only">Your current path.</span> : null}</span>
              <Link className="text-button" href={target.href} aria-label={`${action}: ${path.title}`}>{action}</Link>
            </div>
          </header>
          <Route stops={stops} label={`${path.title} topic sequence`} className="learning-map-flow" linkClass="learning-map-node" />
        </article>;
      })}</div>
    </section>

    <section className="resource-closing" aria-labelledby="practice-safely-title">
      <h2 id="practice-safely-title">Practice with permission</h2><p>Learn with supplied files, synthetic examples, and explicitly authorized labs. Keep private evidence out of public upload services. dfCTF and its infrastructure are not targets for scanning or traffic testing.</p><p>Read the <a href="/rules">Rules / Mechanics</a> before solving. Optional exercises teach techniques without providing challenge answers.</p>
    </section>
  </div>;
}
