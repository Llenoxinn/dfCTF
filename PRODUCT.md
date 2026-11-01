# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Players:** anyone with a verified email who wants to solve CTF challenges and compare progress with other players.
- **Maintainers:** trusted authors, reviewers, and administrators who create challenges and keep the side project running.

## Product Purpose

dfCTF is a capture-the-flag platform built as a side project. A player registers, verifies their email, chooses a codename, opens a challenge, downloads its files, and submits a `dfCTF{...}` flag. The server checks the answer, records a solve, awards points once per challenge family, and unlocks the walkthrough.

The goal is a small CTF platform that is enjoyable to play and practical to maintain. A weekly featured challenge supports the platform; it does not require a weekly publishing commitment.

## Positioning

- A CTF platform with individual challenges and friendly competition.
- Registration is open to anyone with a verified email. There is no invitation or university-domain requirement.
- The current release uses downloadable files. It does not host vulnerable services or execute uploaded programs.
- Published challenges require an independent reviewer to test-solve them.
- Wrong answers cost no points. Weekly and all-time leaderboards show standings.

## Operating Context

- Player flow: register → verify email → choose codename → browse challenges → download files → submit flag → unlock walkthrough → return to saved progress.
- Staff flow: verify MFA in Settings → create draft and files → request review → independent test-solve → publish. Return review to draft for corrections; published versions are locked.
- Administrators can suspend and restore account access. New registrations appear in the account access list automatically.
- Browser theme choices persist locally. Dark is the default.

## Capabilities and Constraints

- Categories: General skills, OSINT, Steganography, Forensics, Web exploitation, Binary exploitation, Miscellaneous.
- Difficulty: Easy, Medium, Hard. Challenges have points, estimated time, tags, files, author, version, and solve count.
- Flags use a server-side keyed digest. Rate limits apply to repeated guesses and authentication requests.
- Uploads: `.txt`, `.csv`, `.json`, `.log`, `.pcap`, `.zip`, `.png`, `.jpg`, `.jpeg`, `.pdf`; 3 MiB each. Files are served as authenticated downloads and never executed or extracted by the platform.
- Sign-in: verified email and password; Google and GitHub when configured. Staff actions also require TOTP or a backup code.
- Leaderboards, recent solves, first-blood labels, activity charts, and progress are implemented. Data refreshes on loading or the relevant weekly boundary; there is no real-time push service.
- Weekly standings follow Asia/Manila time. A tagged challenge is featured only during its publication week; the latest publication wins when several qualify.
- Administrators with current staff MFA can host built-in individual competitions or publish links to existing CTFd hosts. Event titles, descriptions, notes, schedules, native challenge selection, and fixed point values are configurable before publication.
- Competition-only challenges require independent review, stay out of practice, and belong to one event. Registration and start/end boundaries are enforced on the server for details, files, and scoring. Event scores and first blood are separate from practice XP; published event settings remain locked.
- CTFd events open the configured HTTPS host. That host manages its own accounts, challenges, hints, and scores. Paid hints are not implemented in the native dfCTF workspace.
- Stack: Next.js 16, React 19, Better Auth, Drizzle, PostgreSQL; PGlite for local development; plain CSS and existing inline SVG icons.

## Brand Commitments

- Name: **dfCTF**. Existing DFC Developers branding remains.
- Use challenge, description, files, flag, walkthrough, codename, leaderboard, and points. Write the flag wrapper as `dfCTF{...}`.
- Plain, direct copy. Describe implemented behavior; do not promise publishing schedules, live updates, or invented usage statistics.
- Challenge examples are fictional. Do not require attacking real systems or identifying real people.

## Product Principles

1. Make the loop from opening a challenge to submitting a flag reliable.
2. Reuse the existing application and dependencies; add a service only for a demonstrated need.
3. Keep answers and staff actions protected on the server.
4. Prefer a few tested improvements over a broad feature roadmap.
5. Treat errors, empty states, keyboard access, and reduced motion as part of the feature.

## Plan and Evidence

- [Side project plan](docs/MVP.md) tracks scope, next steps, release checks, and known limitations.
- Eight seed challenges and development accounts are available through `npm run seed`, including a Rules / Mechanics reading challenge. Staff can also create its draft from Authoring for independent review.
- Each challenge shows its solvers and one first-blood attribution, with completion times in Asia/Manila. First blood does not award bonus points.
- Rules prohibit LLM-assisted solving, attacks or platform abuse, answer sharing, and plagiarism of challenges; the public rules page includes the reading challenge’s field notes.
- Automated tests cover authentication, access control, challenge lifecycle, scoring, and browser regressions. Production email, external OAuth, and backups need deployment checks.
