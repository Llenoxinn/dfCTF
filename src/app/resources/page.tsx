import type { Metadata } from "next";
import { Icon, Wordmark } from "@/components/ui";
import { RESOURCE_GUIDES, type ResourceTool } from "@/lib/resources";

export const metadata: Metadata = {
  title: "Tutorials & Resources · dfCTF",
  description: "Beginner and deeper cybersecurity guides covering OSINT, audio recovery, forensics, scripting, application security, and defensive operations, with worked examples and official references.",
};

function ToolGuide({ tool, expanded = false }: { tool: ResourceTool; expanded?: boolean }) {
  return <details className="resource-tool" id={tool.id} open={expanded}>
    <summary><h3><span>{tool.name}</span><span className="resource-platform">{tool.platform}</span><span className="resource-disclosure mono" aria-hidden="true"><span>[+]</span><span>[-]</span></span></h3></summary>
    <div className="resource-tool-copy">
      <p>{tool.when}</p>
      <h4>Try the workflow</h4>
      <ol>{tool.steps.map(step => <li key={step}>{step}</li>)}</ol>
      {tool.example ? <figure className="resource-example"><figcaption>{tool.example.label}</figcaption><pre tabIndex={0} aria-label={tool.example.label}><code>{tool.example.code}</code></pre></figure> : null}
      <div className="resource-takeaway"><h4>What to notice</h4><p>{tool.observe}</p></div>
      <div className="resource-pitfall"><h4>Common mistake</h4><p>{tool.pitfall}</p></div>
      <ul className="resource-links" aria-label={`${tool.name} references`}>{tool.links.map(link => <li key={link.href}><a href={link.href}>{link.label}<Icon name="chevron" size={14} /></a></li>)}</ul>
    </div>
  </details>;
}

export default function ResourcesPage() {
  const starterCount = RESOURCE_GUIDES.reduce((total, guide) => total + guide.tools.length, 0);
  const deeperCount = RESOURCE_GUIDES.reduce((total, guide) => total + guide.deeper.length, 0);
  return <div className="resources-page">
    <a className="skip-link" href="#resources-content">Skip to content</a>
    <header className="site-nav rules-nav resources-nav">
      <a className="brand-link" href="/" aria-label="dfCTF home"><Wordmark /></a>
      <nav aria-label="Resources navigation">
        <a className="text-button" href="/rules">Rules / Mechanics</a>
        <a className="button button-secondary" href="/?view=practice">Open challenges</a>
      </nav>
    </header>
    <main id="resources-content" className="resources-main" tabIndex={-1}>
      <div className="resources-heading">
        <span className="label-dot">Learn the tools. Understand the evidence.</span>
        <h1>Tutorials &amp; Resources</h1>
        <p>Start with the essentials, then open <strong>Go deeper</strong> in any area for core concepts, extra tools, and more detailed investigations. Every area includes techniques to compare, results to interpret, and limitations to understand.</p>
        <div className="resources-stats"><span>{RESOURCE_GUIDES.length} areas to explore</span><span>{starterCount} starter guides</span><span>{deeperCount} deeper guides</span><span>No account needed</span></div>
      </div>
      <div className="resources-layout">
        <nav className="resources-index" aria-label="Resource sections">
          <span className="fine">On this page</span>
          <a href="#getting-started">Start here</a>
          {RESOURCE_GUIDES.map(guide => <a href={`#${guide.id}`} key={guide.id}>{guide.title}</a>)}
          <a href="#practice-safely">Practice with permission</a>
        </nav>
        <div className="resources-copy">
          <section className="resources-start" id="getting-started" aria-labelledby="getting-started-title" tabIndex={-1}>
            <h2 id="getting-started-title">Start with a small toolkit</h2>
            <p>Your browser and a terminal are enough to begin. Add a tool when you understand the question you want it to answer. Each guide names its platform, shows a workflow, and links to the original documentation. The additional areas extend beyond the current challenge categories; use them as a learning path, one investigation at a time.</p>
            <ol className="resources-path">
              <li><strong>Set up a workspace.</strong> Keep the original download, make a working copy, and record its SHA-256. Start with the PowerShell guide below.</li>
              <li><strong>Identify the evidence.</strong> Is it text, a picture, a packet capture, or a program? Choose the matching category before trying transformations.</li>
              <li><strong>Make one observation at a time.</strong> Record the command or filter, the result, and why it changes your next step. Keep bytes, encodings, and display formats distinct.</li>
              <li><strong>Explain what you found.</strong> Repeat the steps on your working copy. A useful result is one you can reproduce and understand yourself.</li>
            </ol>
            <p className="resources-platform-note"><strong>On Windows:</strong> PowerShell examples run in PowerShell. Python examples need Python 3; Bash and GDB examples need a suitable Linux environment. <a href="https://learn.microsoft.com/en-us/windows/wsl/install">Microsoft’s WSL setup guide</a> explains the optional Linux tooling. WSL shares access to your host files; use a disposable, isolated virtual machine for unfamiliar executables.</p>
          </section>

          {RESOURCE_GUIDES.map((guide, index) => <section className="resource-section" id={guide.id} key={guide.id} aria-labelledby={`${guide.id}-title`} tabIndex={-1}>
            <div className="resource-section-heading"><span className="resource-number mono" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><div><h2 id={`${guide.id}-title`}>{guide.title}</h2><p>{guide.summary}</p></div></div>
            <div className="resource-tools">{guide.tools.map((tool, toolIndex) => <ToolGuide key={tool.id} tool={tool} expanded={toolIndex === 0} />)}</div>
            <details className="resource-deep-dive" id={`${guide.id}-deeper`}>
              <summary><span><strong>Go deeper <span className="sr-only">in {guide.title}</span></strong><span className="resource-deep-preview">{guide.deeper.length} {guide.deeper.length === 1 ? "extra guide" : "extra guides"} · {guide.deeper.map(tool => tool.name).join(" · ")}</span></span><span className="resource-disclosure mono" aria-hidden="true"><span>[+]</span><span>[-]</span></span></summary>
              <div className="resource-deep-content">
                <div className="resource-area-notes"><h3>Understand the area</h3><dl aria-label={`${guide.title} core concepts`}>{guide.concepts.map(concept => <div key={concept.title}><dt>{concept.title}</dt><dd>{concept.detail}</dd></div>)}</dl></div>
                <div className="resource-tools">{guide.deeper.map(tool => <ToolGuide key={tool.id} tool={tool} />)}</div>
              </div>
            </details>
            <a className="text-button resource-top" href="#resources-content">Back to top</a>
          </section>)}

          <section className="resources-scope" id="practice-safely" aria-labelledby="practice-safely-title" tabIndex={-1}>
            <h2 id="practice-safely-title">Practice with permission</h2>
            <p>These examples teach general techniques using synthetic data. Investigate supplied files or an explicitly authorized training lab. dfCTF and its infrastructure are not targets for scanning, interception, exploitation, or automated guessing.</p>
            <p>Keep private evidence out of public upload services and shared recipe URLs. For unknown programs, use an isolated virtual machine with no personal files or credentials. Read the <a href="/rules">Rules / Mechanics</a> and solve challenges independently; the guides do not provide challenge answers.</p>
            <div className="resources-actions"><a className="button button-primary" href="/?view=practice">Put it into practice</a><a className="text-button" href="/rules">Read the rules</a></div>
          </section>
        </div>
      </div>
    </main>
  </div>;
}
