import type { Metadata } from "next";
import { Icon, Wordmark } from "@/components/ui";
import { RESOURCE_GUIDES, type ResourceTool } from "@/lib/resources";

export const metadata: Metadata = {
  title: "Tutorials & Resources · dfCTF",
  description: "Get to know the main areas of cybersecurity, understand the basics, and explore tools and optional guided exercises at your own pace.",
};

function ToolGuide({ tool }: { tool: ResourceTool }) {
  return <details className="resource-tool" id={tool.id}>
    <summary><h4><span>{tool.name}</span><span className="resource-platform">{tool.platform}</span><span className="resource-disclosure mono" aria-hidden="true"><span>[+]</span><span>[-]</span></span></h4></summary>
    <div className="resource-tool-copy">
      <p>{tool.when}</p>
      <details className="resource-exercise">
        <summary>Try a guided exercise</summary>
        <div className="resource-exercise-copy">
          <ol>{tool.steps.map(step => <li key={step}>{step}</li>)}</ol>
          {tool.example ? <figure className="resource-example"><figcaption>{tool.example.label}</figcaption><pre tabIndex={0} aria-label={tool.example.label}><code>{tool.example.code}</code></pre></figure> : null}
          <div className="resource-takeaway"><h5>What you might notice</h5><p>{tool.observe}</p></div>
          <div className="resource-pitfall"><h5>Keep in mind</h5><p>{tool.pitfall}</p></div>
        </div>
      </details>
      <ul className="resource-links" aria-label={`${tool.name} references`}>{tool.links.map(link => <li key={link.href}><a href={link.href}>{link.label}<Icon name="chevron" size={14} /></a></li>)}</ul>
    </div>
  </details>;
}

export default function ResourcesPage() {
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
        <span className="label-dot">A place to get curious about cybersecurity.</span>
        <h1>Tutorials &amp; Resources</h1>
        <p>Start with an introduction, learn a basic skill, then discover tools that can take you further. Each area follows the same path, with small exercises you can try when you feel ready.</p>
        <div className="resources-stats"><span>{RESOURCE_GUIDES.length} areas to discover</span><span>Read at your own pace</span><span>Optional hands-on exercises</span><span>No account needed</span></div>
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
            <h2 id="getting-started-title">Start with the big picture</h2>
            <p>Cybersecurity is about understanding how technology works, how things can go wrong, and how to protect people and information. Some areas investigate clues left in files. Others focus on websites, software, networks, or the people who can access them.</p>
            <p>You do not need to learn everything at once or install a collection of tools. Choose a topic that interests you and follow it a little further.</p>
            <ol className="resources-path">
              <li><strong>Understand the area.</strong> Read what it is about, why it matters, and the ideas you will use.</li>
              <li><strong>Learn a first skill.</strong> Start with one approachable lesson. That might be a few terminal commands, reading an image, or understanding a browser request.</li>
              <li><strong>Explore useful tools.</strong> See what each tool helps with once you know the question you want to answer.</li>
              <li><strong>Go deeper.</strong> Open further guides and try their exercises at your own pace. Nothing needs to be completed before you can keep reading.</li>
            </ol>
            <details className="resources-setup"><summary>Before your first exercise</summary><div className="resources-setup-copy">
            <ol className="resources-path">
              <li><strong>Set up a workspace.</strong> Keep the original download, make a working copy, and record its SHA-256. Start with the PowerShell guide below.</li>
              <li><strong>Identify the evidence.</strong> Is it text, a picture, a packet capture, or a program? Choose the matching category before trying transformations.</li>
              <li><strong>Make one observation at a time.</strong> Record the command or filter, the result, and why it changes your next step. Keep bytes, encodings, and display formats distinct.</li>
              <li><strong>Explain what you found.</strong> Repeat the steps on your working copy. A useful result is one you can reproduce and understand yourself.</li>
            </ol>
            <p className="resources-platform-note"><strong>On Windows:</strong> PowerShell examples run in PowerShell. Python examples need Python 3; Bash and GDB examples need a suitable Linux environment. <a href="https://learn.microsoft.com/en-us/windows/wsl/install">Microsoft’s WSL setup guide</a> explains the optional Linux tooling. WSL shares access to your host files; use a disposable, isolated virtual machine for unfamiliar executables.</p>
            </div></details>
          </section>

          {RESOURCE_GUIDES.map((guide, index) => {
            const furtherTools = [...guide.tools.slice(1), ...guide.deeper];
            return <section className="resource-section" id={guide.id} key={guide.id} aria-labelledby={`${guide.id}-title`} tabIndex={-1}>
            <div className="resource-section-heading"><span className="resource-number mono" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><div><h2 id={`${guide.id}-title`}>{guide.title}</h2><p>{guide.summary}</p></div></div>
            <div className="resource-area-notes"><h3>Start with the basics</h3><dl aria-label={`${guide.title} core concepts`}>{guide.concepts.map(concept => <div key={concept.title}><dt>{concept.title}</dt><dd>{concept.detail}</dd></div>)}</dl></div>
            <h3 className="resource-tools-title">Your first steps</h3>
            <div className="resource-tools"><ToolGuide tool={guide.tools[0]} /></div>
            <h3 className="resource-tools-title">Tools to explore next</h3>
            <ul className="resource-recommendations" aria-label={`${guide.title} tool recommendations`}>{furtherTools.map(tool => <li key={tool.id}><strong>{tool.name}</strong><p>{tool.when}</p></li>)}</ul>
            <details className="resource-deep-dive" id={`${guide.id}-deeper`}>
              <summary><span><strong>Go deeper <span className="sr-only">in {guide.title}</span></strong><span className="resource-deep-preview">{furtherTools.length} further guides with optional exercises.</span></span><span className="resource-disclosure mono" aria-hidden="true"><span>[+]</span><span>[-]</span></span></summary>
              <div className="resource-deep-content">
                <div className="resource-tools">{furtherTools.map(tool => <ToolGuide key={tool.id} tool={tool} />)}</div>
              </div>
            </details>
            <a className="text-button resource-top" href="#resources-content">Back to top</a>
          </section>; })}

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
