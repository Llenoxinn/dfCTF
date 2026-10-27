import type { Metadata } from "next";
import { RULE_SECTIONS, RULES_CHALLENGE_TITLE } from "@/lib/rules";
import { Wordmark } from "@/components/ui";

export const metadata: Metadata = { title: "Rules / Mechanics · dfCTF" };

export default function RulesPage() {
  return <div className="rules-page">
    <a className="skip-link" href="#rules-content">Skip to content</a>
    <header className="site-nav rules-nav">
      <a className="brand-link" href="/?view=home" aria-label="dfCTF home"><Wordmark /></a>
      <a className="button button-secondary" href="/?view=practice">Open challenges</a>
    </header>
    <main id="rules-content" className="rules-main">
      <div className="page-head"><div><h1>Rules / Mechanics</h1><p>Read the rules before your first flag. Keep the competition fair, the platform safe, and the work your own.</p></div></div>
      <div className="rules-layout">
        <nav className="rules-index" aria-label="Rules sections">{RULE_SECTIONS.map(section => <a href={`#${section.id}`} key={section.id}>{section.title}</a>)}</nav>
        <article className="rules-copy">
          {RULE_SECTIONS.map(section => <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`}>
            <h2 id={`${section.id}-title`}>{section.title}</h2>
            {section.paragraphs.map(text => <p key={text}>{text}</p>)}
            {"note" in section ? <p className="rules-note">Field note <code>{section.note}</code></p> : null}
          </section>)}
          <section className="rules-checkpoint" aria-labelledby="checkpoint-title">
            <h2 id="checkpoint-title">Read it all?</h2>
            <p>The three field notes form one flag. Join them in reading order, without spaces, and submit it to <strong>{RULES_CHALLENGE_TITLE}</strong> in the challenge library.</p>
            <a className="button button-primary" href="/?view=practice">Find the challenge</a>
          </section>
        </article>
      </div>
    </main>
  </div>;
}
