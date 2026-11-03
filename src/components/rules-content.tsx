import { RULE_SECTIONS, RULES_CHALLENGE_TITLE } from "@/lib/rules";
import type { LineSidebarItem } from "./line-sidebar";
import RulesNavigation from "./rules-navigation";

const INDEX: LineSidebarItem[] = RULE_SECTIONS.map(section => ({ label: section.title, href: `#${section.id}` }));

/** The rules text, shared by the public /rules page and the Rules tab inside the app. Only navigation needs browser hooks. */
export default function RulesContent() {
  return <>
    <div className="page-head rules-heading"><div><h1>Rules / Mechanics</h1><p>Read the rules before your first flag. Keep the competition fair, the platform safe, and the work your own.</p></div></div>
    <div className="rules-layout">
      <RulesNavigation items={INDEX} />
      <article className="rules-copy">
        {RULE_SECTIONS.map(section => <section key={section.id} id={section.id} tabIndex={-1} aria-labelledby={`${section.id}-title`}>
          <h2 id={`${section.id}-title`}>{section.title}</h2>
          {section.paragraphs.map(text => <p key={text}>{text}</p>)}
          {section.id === "scope" || section.id === "allowed-tools" ? <p><a className="link-button" href="/support">Contact the maintainers privately</a> for help or a report.</p> : null}
          {"note" in section ? <p className="rules-note">Field note <code>{section.note}</code></p> : null}
        </section>)}
        <section className="rules-checkpoint" aria-labelledby="checkpoint-title">
          <h2 id="checkpoint-title">Read it all?</h2>
          <p>The three field notes form one flag. Join them in reading order, without spaces, and submit it to <strong>{RULES_CHALLENGE_TITLE}</strong> in the challenge library.</p>
          <a className="button button-primary" href="/?view=practice">Find the challenge</a>
        </section>
      </article>
    </div>
  </>;
}
