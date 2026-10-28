"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LEARNING_PATHS, TOPIC_INFO, matchingTools, type ResourceCard } from "@/lib/resource-learning";
import { useResourceProgress } from "./resource-progress";

export default function ResourceLibrary({ guides }: { guides: ResourceCard[] }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("");
  const [platform, setPlatform] = useState("");
  const { progress, setProgress, ready, canSave } = useResourceProgress();
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
  const last = guides.find(guide => guide.id === progress.last?.topic);
  const clear = () => { setQuery(""); setLevel(""); setPlatform(""); };
  const bookmark = (id: string) => setProgress(current => ({ ...current, bookmarks: current.bookmarks.includes(id) ? current.bookmarks.filter(key => key !== id) : [...current.bookmarks, id] }));

  return <>
    <div className="resources-heading">
      <span className="label-dot">A place to get curious about cybersecurity.</span>
      <h1>Tutorials &amp; Resources</h1>
      <p>Get the big picture, learn a first skill, then explore tools and deeper guides. Pick one topic or follow a learning path. Practice is there when you feel ready.</p>
      <div className="resources-stats"><span>{guides.length} areas to discover</span><span>Optional exercises</span><span>No account needed</span></div>
    </div>
    <section className="resource-welcome" aria-labelledby="start-reading-title">
      <div><h2 id="start-reading-title">Start with the big picture</h2><p>Cybersecurity covers understanding systems, investigating evidence, and protecting people and information. You do not need to learn it all at once.</p><p>Each topic goes from an introduction to the basics, a first skill, useful tools, and more depth. Click an underlined technical term for a plain-language explanation.</p></div>
      <div className="resource-start-actions"><Link className="button button-primary" href="/resources/general-skills?path=foundations">Start with the foundations</Link><a className="text-button" href="#learning-paths">Explore learning paths</a></div>
    </section>

    {ready && (last || progress.bookmarks.length > 0) ? <section className="resource-saved" aria-labelledby="your-learning-title">
      <div className="resource-section-bar"><h2 id="your-learning-title">Your learning</h2><span className="fine">{progress.completed.length} of {guides.length} topics marked read</span></div>
      {last ? <Link className="button button-secondary" href={`/resources/${last.id}${progress.last!.path ? `?path=${progress.last!.path}` : ""}#${progress.last!.section}`}>Continue reading: {last.title}</Link> : null}
      {progress.bookmarks.length ? <><h3>Bookmarks</h3><ul className="resource-bookmarks">{progress.bookmarks.map(key => {
        const [topicId, toolId] = key.split("/");
        const topic = guides.find(guide => guide.id === topicId);
        const tool = topic?.tools.find(tool => tool.id === toolId);
        if (!topic || (toolId && !tool)) return null;
        const label = tool ? `${tool.name} · ${topic.title}` : topic.title;
        return <li key={key}><Link href={`/resources/${topic.id}${tool ? `#${tool.id}` : ""}`}>{label}</Link><button type="button" className="text-button" onClick={() => bookmark(key)} aria-label={`Remove bookmark: ${label}`}>Remove</button></li>;
      })}</ul></> : null}
    </section> : null}
    <p className="resource-save-note" role="status">{canSave ? "Your reading place, open guides, bookmarks, and topics marked read are saved in this browser. They do not sync between devices." : "Browser storage is unavailable. You can keep reading, but your place and bookmarks will not survive a reload."}</p>

    <section aria-labelledby="browse-topics-title" className="resource-browse">
      <h2 id="browse-topics-title">Find your next topic</h2>
      <div className="resource-filters" role="search" aria-label="Search resources">
        <label className="field"><span>Search topics or tools</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setQuery(""); }} placeholder="Try PowerShell, audio, or metadata" /></label>
        <label className="field"><span>Starting level</span><select value={level} onChange={event => setLevel(event.target.value)}><option value="">All levels</option><option>Beginner</option><option>Intermediate</option></select></label>
        <label className="field"><span>Platform</span><select value={platform} onChange={event => setPlatform(event.target.value)}><option value="">All platforms</option>{["Windows", "macOS", "Linux", "Browser"].map(value => <option key={value}>{value}</option>)}</select></label>
      </div>
      <div className="resource-section-bar"><p aria-live="polite">{filtered.length} of {guides.length} topics{query || level || platform ? " match" : ""}</p>{query || level || platform ? <button type="button" className="text-button" onClick={clear}>Clear filters</button> : null}</div>
      {filtered.length ? <div className="resource-topic-grid">{filtered.map(guide => {
        const tools = matchingTools(guide, query, platform);
        const saved = progress.bookmarks.includes(guide.id);
        return <article className="resource-topic-card" key={guide.id}>
          <div className="resource-section-bar"><span className="fine">Starts at {TOPIC_INFO[guide.id].level.toLowerCase()}</span>{progress.completed.includes(guide.id) ? <span className="fine accent">Marked read</span> : null}</div>
          <h3><Link href={`/resources/${guide.id}`}>{guide.title}</Link></h3>
          <p>{guide.summary}</p>
          <p className="resource-tool-preview">{query || platform ? "Matching tools" : "Explore tools"}: {tools.slice(0, 3).map(tool => tool.name).join(" · ")}{tools.length > 3 ? ` · +${tools.length - 3} more` : ""}</p>
          <div className="resource-section-bar"><Link className="text-button" href={`/resources/${guide.id}`}>Explore {guide.title}</Link><button type="button" className="text-button" disabled={!ready} aria-pressed={saved} aria-label={`Bookmark ${guide.title}`} onClick={() => bookmark(guide.id)}>{saved ? "Bookmarked" : "Bookmark"}</button></div>
          {query || platform ? <ul className="resource-matches" aria-label={`${guide.title} matching tools`}>{tools.map(tool => <li key={tool.id}><Link href={`/resources/${guide.id}#${tool.id}`}>{tool.name}</Link><span>{tool.platform}</span></li>)}</ul> : null}
        </article>;
      })}</div> : <div className="resource-empty"><h3>No topics match yet</h3><p>Try a shorter search or choose another level or platform.</p><button type="button" className="button button-secondary" onClick={clear}>Show all topics</button></div>}
    </section>

    <section id="learning-paths" className="resource-paths" aria-labelledby="learning-paths-title">
      <h2 id="learning-paths-title">Learning paths</h2><p>Follow a suggested order or jump to anything that interests you. Marking a topic read records your own progress; there is no test to unlock the next one.</p>
      <div className="resource-topic-grid">{LEARNING_PATHS.map(path => <article className="resource-topic-card" key={path.id}>
        <span className="fine">{path.topics.filter(topic => progress.completed.includes(topic)).length} of {path.topics.length} topics marked read</span>
        <h3>{path.title}</h3><p>{path.summary}</p>
        <ol className="resource-path-outline">{path.topics.map(id => <li key={id}><Link href={`/resources/${id}?path=${path.id}`}>{guides.find(guide => guide.id === id)!.title}</Link>{progress.completed.includes(id) ? <span className="sr-only">, marked read</span> : null}</li>)}</ol>
        <Link className="button button-secondary" href={`/resources/${path.topics[0]}?path=${path.id}`}>Start {path.title}</Link>
      </article>)}</div>
    </section>
    <section className="resources-scope" aria-labelledby="practice-safely-title">
      <h2 id="practice-safely-title">Practice with permission</h2><p>Learn with supplied files, synthetic examples, and explicitly authorized labs. Keep private evidence out of public upload services. dfCTF and its infrastructure are not targets for scanning or traffic testing.</p><p>Read the <a href="/rules">Rules / Mechanics</a> before solving. Optional exercises teach techniques without providing challenge answers.</p>
    </section>
  </>;
}
