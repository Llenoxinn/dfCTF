"use client";

import CampusScene from "./campus-scene";
import { Brand, Difficulty, GlyphTile, Icon, Pixel, ThemeToggle } from "./ui";

const CATEGORIES = [
  { name: "General skills", glyph: "general", body: "The command line, files, encodings, and the habits every investigation starts with." },
  { name: "OSINT", glyph: "osint", body: "Metadata and public traces from fictional people and places. Never a real person." },
  { name: "Steganography", glyph: "steg", body: "Data hidden inside images and other files, past what a viewer shows you." },
  { name: "Forensics", glyph: "forensics", body: "Logs, packet captures, and recovered files. Reconstruct what happened, in order." },
  { name: "Web exploitation", glyph: "web", body: "Saved requests, cookies, and access control, studied from transcripts you download." },
  { name: "Binary exploitation", glyph: "binary", body: "Reading memory and debugger output before you ever touch an exploit." },
  { name: "Miscellaneous", glyph: "misc", body: "Puzzles that cross categories: sorting, patterns, and a little scripting." },
];

const RULES = [
  { glyph: "check", title: "Wrong answers are free", body: "No XP is ever taken away. After too many tries in a row you wait out a short cooldown, and that is all." },
  { glyph: "flag", title: "XP is earned once", body: "Each challenge awards its XP the first time you solve it, tied to the version you solved." },
  { glyph: "lock", title: "The answer stays on the server", body: "Flags are checked server-side against a keyed digest. Nothing in the page can tell you if you are close." },
  { glyph: "book", title: "The walkthrough unlocks after the solve", body: "Once you capture a flag, read how the author intended it to be solved and compare notes." },
  { glyph: "osint", title: "Everything is fictional", body: "Every target, person, and campus in a challenge is invented. You never attack a real system." },
  { glyph: "key", title: "Your codename is public, your email is not", body: "Choose how you appear. Your email and sign-in providers stay private to you and staff." },
];

export default function Landing({ signIn, createAccount }: { signIn: () => void; createAccount: () => void }) {
  return <div className="landing">
    <a className="skip-link" href="#landing-main">Skip to content</a>
    <header className="landing-bar">
      <a className="brand-link" href="/" aria-label="dfCTF home"><Brand/></a>
      <nav className="landing-nav" aria-label="Sections">
        <a href="#how">How a case works</a><a href="#categories">Categories</a><a href="#rules">House rules</a><a href="#staff">For staff</a>
      </nav>
      <div className="landing-actions"><ThemeToggle compact/><button className="button button-quiet" onClick={signIn}>Sign in</button><button className="button button-primary" onClick={createAccount}>Create account</button></div>
    </header>

    <main id="landing-main">
      <section className="hero">
        <div className="hero-copy">
          <p className="beta-pill"><span className="beta-dot" aria-hidden="true"/>Private beta, by invitation</p>
          <h1 className="display">Learn security by solving cases.</h1>
          <p className="hero-lede">dfCTF is a capture-the-flag practice library. Download the evidence from a fictional investigation, work it on your own machine, and submit the flag you find. Practice is open whenever you are.</p>
          <div className="hero-cta"><button className="button button-primary button-large" onClick={createAccount}>Create your account</button><button className="button button-secondary button-large" onClick={signIn}>Sign in</button></div>
          <p className="hero-note">Your organizer adds your email to the beta list first. Then you can register and choose a codename.</p>
        </div>
        <div className="hero-stage">
          <CampusScene width={512} height={176} className="hero-scene"/>
          <HeroPreview/>
        </div>
      </section>

      <section className="landing-section" id="how" aria-labelledby="how-title">
        <div className="section-intro"><h2 id="how-title">How a case works</h2><p>Every challenge follows the same four steps. The investigation happens on your machine; only the flag comes back.</p></div>
        <ol className="case-flow">
          <li><span className="flow-step">1</span><h3>Read the brief</h3><p>A short scene, the objective, and the flag format you are looking for.</p><code className="flow-sample">dfctf{"{…}"}</code></li>
          <li><span className="flow-step">2</span><h3>Download the evidence</h3><p>Every file lists its size and SHA-256 checksum, so you can confirm you have the right copy.</p><div className="flow-file"><Icon name="file" size={16}/>access.log<span>312 B</span></div></li>
          <li><span className="flow-step">3</span><h3>Work it locally</h3><p>A text editor, a terminal, a spreadsheet. Use whatever tools you already know.</p><code className="flow-sample">$ grep evidence access.log</code></li>
          <li><span className="flow-step">4</span><h3>Submit the flag</h3><p>The server checks it. A correct flag records your solve, awards XP once, and opens the walkthrough.</p><div className="flow-result"><Pixel name="check" size={12}/>Flag accepted, +50 XP</div></li>
        </ol>
      </section>

      <section className="landing-section" id="categories" aria-labelledby="categories-title">
        <div className="section-intro"><h2 id="categories-title">Seven categories to start</h2><p>Filter the library by category, difficulty, and progress. Start wherever you are curious; nothing is locked behind another case.</p></div>
        <ul className="category-grid">
          {CATEGORIES.map(c => <li key={c.name}><GlyphTile name={c.glyph}/><h3>{c.name}</h3><p>{c.body}</p></li>)}
          <li className="category-next"><GlyphTile name="crypto"/><h3>Next up</h3><p>Cryptography and reverse engineering are proposed for a later release.</p></li>
        </ul>
      </section>

      <section className="landing-section rules-section" id="rules" aria-labelledby="rules-title">
        <div className="section-intro"><h2 id="rules-title">House rules</h2><p>Practice is for learning. These rules are built into the platform, not left to good intentions.</p></div>
        <ul className="rules-list">{RULES.map(rule => <li key={rule.title}><Pixel name={rule.glyph} size={16}/><div><h3>{rule.title}</h3><p>{rule.body}</p></div></li>)}</ul>
      </section>

      <section className="landing-section staff-section" id="staff" aria-labelledby="staff-title">
        <div className="section-intro"><h2 id="staff-title">For authors and reviewers</h2><p>Challenges reach the library only after someone other than the author has solved them. Staff tools require an authenticator app and a fresh verification each session.</p></div>
        <ol className="review-flow">
          <li><span className="status-badge status-draft">Draft</span><h3>Author writes the case</h3><p>Brief, walkthrough, flag, and evidence files. The flag is stored as a digest and never shown again.</p></li>
          <li><span className="status-badge status-review">In review</span><h3>A second person solves it</h3><p>The reviewer downloads the evidence and must submit the correct flag to approve it.</p></li>
          <li><span className="status-badge status-published">Published</span><h3>Learners can open it</h3><p>It appears in the library. An administrator can archive it to take it out of practice.</p></li>
        </ol>
      </section>
    </main>

    <section className="closing" aria-labelledby="closing-title">
      <div className="closing-inner">
        <Pixel name="flag" size={40}/>
        <h2 id="closing-title">The evidence is waiting.</h2>
        <p>Every case rewards the same habit: look closely at what you were given before you reach for tools.</p>
        <div className="hero-cta"><button className="button button-inverse button-large" onClick={createAccount}>Create your account</button><button className="button button-inverse-quiet button-large" onClick={signIn}>Sign in</button></div>
      </div>
    </section>

    <footer className="landing-footer"><Brand compact/><span>A private practice platform. All challenge content is fictional.</span><ThemeToggle/></footer>
  </div>;
}

function HeroPreview() {
  return <figure className="hero-preview" aria-label="Preview of a challenge page">
    <div className="preview-bar" aria-hidden="true"><span/><span/><span/><em>Case: The midnight request</em></div>
    <div className="preview-body" aria-hidden="true">
      <div className="preview-main">
        <div className="preview-meta"><GlyphTile name="forensics" size="sm"/>Forensics<Difficulty value="Easy"/></div>
        <strong className="preview-title">The midnight request</strong>
        <p>A fictional campus service logged a request shortly after midnight. Find the unusual parameter and decode it.</p>
        <div className="preview-file"><Icon name="file" size={15}/><span>access.log</span><small>312 B</small><Icon name="download" size={15}/></div>
      </div>
      <div className="preview-side">
        <span className="preview-label">Your flag</span>
        <span className="preview-input">dfctf{"{example_flag}"}</span>
        <span className="preview-success"><Pixel name="check" size={11}/>Flag captured. +50 XP</span>
      </div>
    </div>
    <figcaption className="sr-only">A challenge page shows the brief, a downloadable evidence file, and a flag field with a captured result.</figcaption>
  </figure>;
}
