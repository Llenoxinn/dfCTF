# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Players:** students at our university, beginners to intermediate in security, who want hands-on CTF practice. They play on their own schedule, on their own machine, alongside coursework, and compete on the leaderboard.
- **Staff:** authors who write cases, reviewers who independently test-solve them, and administrators who manage the beta list. Staff use the same app behind an authenticator check.

## Product Purpose

dfCTF is a capture-the-flag platform built by **DFC Developers** (a student developer group) for people at our university. A player opens a challenge, reads the description, downloads the files, works them locally, and submits a flag in the format `dfCTF{...}` (lowercase "df", uppercase "CTF") that the server checks. A first solve awards points once and unlocks the author's walkthrough. Points feed a leaderboard. Success is a player who keeps coming back for the next challenge and the weekly drop.

## Positioning

- Every case is a fictional investigation with real downloadable evidence (logs, packet captures, images, documents), not a hosted vulnerable service.
- Nothing is published until someone other than the author has solved it and submitted the correct flag.
- Our own platform, not a public archive: challenges are written by DFC Developers and our community for our university.
- Hands-on and friendly competition: wrong answers are free, points are earned once, and a leaderboard (weekly and overall) shows standings.
- Not private or invite-only in positioning (user, 2026-10-21). Who may register (anyone vs. university emails) is undecided; the current code still has an allowlist.

## Operating Context

- Learner flow: landing → create account (allowlisted email) → verify email → choose a public codename → overview → library (filter by category, difficulty, progress) → case (brief, evidence with size + SHA-256, flag form) → walkthrough after solve → progress.
- Staff flow: settings → set up authenticator → verify session (lasts up to 12 hours) → authoring (draft → in review → published → archived) → editor (case text, evidence upload, details, flag, publishing checklist) → reviewer test-solve publishes.
- Administrators manage the beta list (allowlist) and can archive cases.
- Light and dark themes, chosen per browser; system preference by default.

## Capabilities and Constraints

- Categories (seven): General skills, OSINT, Steganography, Forensics, Web exploitation, Binary exploitation, Miscellaneous. Cryptography and reverse engineering are proposed for later.
- Difficulties: Easy, Medium, Hard. Each case has XP, estimated minutes, solve count, author, version, tags.
- Flags are checked server-side against a keyed digest. A cooldown follows several quick misses.
- Uploads: .txt .csv .json .log .pcap .zip .png .jpg .jpeg .pdf, 10 MiB each, never opened or executed.
- Sign-in: email + password (15+ characters), optional Google and GitHub when configured; staff need TOTP or backup codes.
- Stack: Next.js 16 (custom, read node_modules/next/dist/docs before writing code), React 19, plain CSS in `src/app/globals.css`, Phosphor icons available, no Tailwind.
- Leaderboard: requested by the user (2026-10-21); not yet built in the backend.
- Undecided: registration rules (open vs. university email), first-blood display, codename changes, staff role management UI.

## Brand Commitments

- **Standing direction (user, 2026-10-21): a typical CTF platform, executed at full craft.** Craft bar: Hack The Box, CTFd, picoCTF. No campus theme, no pixel campus scene, no "Day/Night shift", no themed metaphor (evidence lockers, transit maps, contact sheets). The unique selling point is that it is our university's own CTF, built and run by DFC Developers.
- A **weekly challenge** is an additional feature (one featured challenge per week), not the identity of the product.
- Name: **dfCTF**. User-facing terms: challenge (not "case"), description, files, flag, walkthrough, codename, library, leaderboard, points (pts). Flag format is always written `dfCTF{...}`.
- Voice: plain, calm, direct, sentence case; errors say what happened and what to do; no hype.
- All challenge content is fictional; no real people, systems, or campuses.

## Evidence on Hand

- Seven seeded fictional cases (scripts/seed.ts), e.g. "The midnight request" (Forensics, Easy, access.log 312 B).
- No testimonials, user counts, partner logos, or institution names exist. Do not invent them.

## Product Principles

1. The evidence is the hero: every screen gets a learner closer to opening, working, or submitting a case.
2. Calm over competitive: progress is personal; nothing punishes a wrong answer.
3. Trust is shown, not claimed: checksums, server-side checks, and independent review are visible facts.
4. Staff rigor without friction for learners.

## Accessibility & Inclusion

- WCAG 2.1 AA: visible keyboard focus, reduced motion respected, readable at small sizes; many learners work late on laptops.
