import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { CATEGORIES } from "@/lib/types";
import { RESOURCE_GUIDES, type ResourceGuide, type ResourceTool } from "@/lib/resources";
import GuideOpener from "./guide-opener";
import LineSidebar, { PAGE_INDEX, type LineSidebarItem } from "./line-sidebar";
import { Icon } from "./ui";

type Destination = "practice" | "rules";
/** Inside the app, links to Challenges and Rules switch tabs in place; on the public page they are ordinary links. */
export type OpenView = (event: MouseEvent<HTMLAnchorElement>, view: Destination) => void;

// The challenge categories come first; the extra areas follow as a separate group in the index.
const challengeAreas = RESOURCE_GUIDES.filter(guide => (CATEGORIES as readonly string[]).includes(guide.title));
const moreAreas = RESOURCE_GUIDES.filter(guide => !challengeAreas.includes(guide));
const area = (group: string) => (guide: ResourceGuide, i: number): LineSidebarItem => ({ label: guide.title, href: `#${guide.id}`, ...(i === 0 ? { group } : {}) });
const INDEX: LineSidebarItem[] = [
  { label: "Start here", href: "#getting-started" },
  ...challengeAreas.map(area("Challenge categories")),
  ...moreAreas.map(area("Going further")),
  { label: "Practice with permission", href: "#practice-safely" },
];

function ViewLink({ to, openView, className, children }: { to: Destination; openView?: OpenView; className?: string; children: ReactNode }) {
  const href = to === "practice" ? "/?view=practice" : openView ? "/?view=rules" : "/rules";
  return <Link className={className} href={href} onClick={openView ? event => openView(event, to) : undefined}>{children}</Link>;
}

const Disclosure = () => <span className="resource-disclosure mono" aria-hidden="true"><span>[+]</span><span>[-]</span></span>;

function ToolGuide({ tool }: { tool: ResourceTool }) {
  return <details className="resource-tool" id={tool.id}>
    <summary><span className="resource-tool-name">{tool.name}</span><span className="resource-platform">{tool.platform}</span><Disclosure /></summary>
    <div className="resource-tool-copy">
      <p>{tool.when}</p>
      <details className="resource-exercise">
        <summary>Try a guided exercise<Disclosure /></summary>
        <div className="resource-exercise-copy">
          <ol>{tool.steps.map(step => <li key={step}>{step}</li>)}</ol>
          {tool.example ? <figure className="resource-example"><figcaption>{tool.example.label}</figcaption><pre tabIndex={0} aria-label={tool.example.label}><code>{tool.example.code}</code></pre></figure> : null}
          <div className="resource-takeaway"><h4>What you might notice</h4><p>{tool.observe}</p></div>
          <div className="resource-pitfall"><h4>Keep in mind</h4><p>{tool.pitfall}</p></div>
        </div>
      </details>
      <ul className="resource-links" aria-label={`${tool.name} references`}>{tool.links.map(link => <li key={link.href}><a href={link.href}>{link.label}<Icon name="chevron" size={14} /></a></li>)}</ul>
    </div>
  </details>;
}

/** Each area reads like a lesson: what it is, the basic ideas, one first tool, then the rest to explore. */
function GuideSection({ guide }: { guide: ResourceGuide }) {
  const furtherTools = [...guide.tools.slice(1), ...guide.deeper];
  return <section className="resource-section" id={guide.id} aria-labelledby={`${guide.id}-title`} tabIndex={-1}>
    <div className="resource-section-heading"><h2 id={`${guide.id}-title`}>{guide.title}</h2><p>{guide.summary}</p></div>
    <div className="resource-area-notes"><h3>Start with the basics</h3><dl aria-label={`${guide.title} core concepts`}>{guide.concepts.map(concept => <div key={concept.title}><dt>{concept.title}</dt><dd>{concept.detail}</dd></div>)}</dl></div>
    <h3 className="resource-tools-title">Your first steps</h3>
    <div className="resource-tools"><ToolGuide tool={guide.tools[0]} /></div>
    <h3 className="resource-tools-title">Tools to explore next</h3>
    {/* Each name opens its guide below, inside Go deeper. */}
    <ul className="resource-recommendations" aria-label={`${guide.title} tool recommendations`}>{furtherTools.map(tool => <li key={tool.id}><a href={`#${tool.id}`}>{tool.name}</a><p>{tool.when}</p></li>)}</ul>
    <details className="resource-deep-dive" id={`${guide.id}-deeper`}>
      <summary><span><strong>Go deeper <span className="sr-only">in {guide.title}</span></strong><span className="resource-deep-preview">{furtherTools.length} further guides with optional exercises.</span></span><Disclosure /></summary>
      <div className="resource-deep-content"><div className="resource-tools">{furtherTools.map(tool => <ToolGuide key={tool.id} tool={tool} />)}</div></div>
    </details>
    <a className="text-button resource-top" href="#resources-top">Back to top</a>
  </section>;
}

/** The tutorials, shared by the public /resources page and the Resources tab inside the app. Only the guide opener runs in the browser. */
export default function ResourcesContent({ openView }: { openView?: OpenView }) {
  return <div className="resources" id="resources-top">
    <div className="page-head"><div><h1>Tutorials &amp; Resources</h1><p>Start with an introduction, learn a basic skill, then discover tools that can take you further. Each area follows the same path, with small exercises you can try when you feel ready.</p></div></div>
    <div className="resources-layout">
      <LineSidebar className="resources-index" label="Resource sections" items={INDEX} spy {...PAGE_INDEX} />
      <div className="resources-copy">
        <section className="resources-start" id="getting-started" aria-labelledby="getting-started-title" tabIndex={-1}>
          <h2 id="getting-started-title">Start with the big picture</h2>
          <p>Cybersecurity is about understanding how technology works, how things can go wrong, and how to protect people and information. Some areas investigate clues left in files. Others focus on websites, software, networks, or the people who can access them.</p>
          <p>You do not need to learn everything at once or install a collection of tools. Choose a topic that interests you and follow it a little further.</p>
          <ol className="resources-path">
            <li><strong>Understand the area.</strong> Read what it is about, why it matters, and the ideas you will use.</li>
            <li><strong>Learn a first skill.</strong> Start with one approachable lesson. That might be a few terminal commands, reading an image, or understanding a browser request.</li>
            <li><strong>Explore useful tools.</strong> See what each tool helps with once you know the question you want to answer.</li>
            <li><strong>Go deeper.</strong> Open further guides and try their exercises at your own pace. Nothing needs to be completed before you can keep reading.</li>
          </ol>
          <details className="resources-setup" id="before-exercises">
            <summary>Before your first exercise<Disclosure /></summary>
            <div className="resources-setup-copy">
              <ol className="resources-path">
                <li><strong>Set up a workspace.</strong> Keep the original download, make a working copy, and record its SHA-256 so you can tell later whether anything changed. The <a href="#powershell">PowerShell guide</a> shows how.</li>
                <li><strong>Identify the evidence.</strong> Is it text, a picture, a packet capture, or a program? Choose the matching category before trying transformations.</li>
                <li><strong>Make one observation at a time.</strong> Record the command or filter, the result, and why it changes your next step. Keep bytes, encodings, and display formats distinct.</li>
                <li><strong>Explain what you found.</strong> Repeat the steps on your working copy. A useful result is one you can reproduce and understand yourself.</li>
              </ol>
              <p className="resources-platform-note"><strong>On Windows:</strong> PowerShell examples run in PowerShell. Python examples need Python 3; Bash and GDB examples need a suitable Linux environment. <a href="https://learn.microsoft.com/en-us/windows/wsl/install">Microsoft’s WSL setup guide</a> explains the optional Linux tooling. WSL shares access to your host files; use a disposable, isolated virtual machine for unfamiliar executables.</p>
            </div>
          </details>
        </section>

        {[...challengeAreas, ...moreAreas].map(guide => <GuideSection key={guide.id} guide={guide} />)}

        <section className="resources-scope" id="practice-safely" aria-labelledby="practice-safely-title" tabIndex={-1}>
          <h2 id="practice-safely-title">Practice with permission</h2>
          <p>These examples teach general techniques using synthetic data. Investigate supplied files or an explicitly authorized training lab. dfCTF and its infrastructure are not targets for scanning, interception, exploitation, or automated guessing.</p>
          <p>Keep private evidence out of public upload services and shared recipe URLs. For unknown programs, use an isolated virtual machine with no personal files or credentials. Read the <ViewLink to="rules" openView={openView}>Rules / Mechanics</ViewLink> and solve challenges independently; the guides do not provide challenge answers.</p>
          <div className="resources-actions"><ViewLink to="practice" openView={openView} className="button button-primary">Put it into practice</ViewLink><ViewLink to="rules" openView={openView} className="text-button">Read the rules</ViewLink></div>
        </section>
      </div>
    </div>
    <GuideOpener />
  </div>;
}
