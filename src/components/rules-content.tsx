import { RULE_SECTIONS, RULES_CHALLENGE_TITLE } from "@/lib/rules";
import LineSidebar, { PAGE_INDEX, type LineSidebarItem } from "./line-sidebar";

const INDEX: LineSidebarItem[] = RULE_SECTIONS.map(section => ({ label: section.title, href: `#${section.id}` }));

/** The rules text, shared by the public /rules page and the Rules tab inside the app. No hooks; only the index runs in the browser. */
export default function RulesContent() {
  return <>
    <div className="page-head"><div><h1>Rules / Mechanics</h1><p>Read the rules before your first flag. Keep the competition fair, the platform safe, and the work your own.</p></div></div>
    <div className="rules-layout">
      <LineSidebar className="rules-index" label="Rules sections" items={INDEX} spy {...PAGE_INDEX} />
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
  </>;
}
