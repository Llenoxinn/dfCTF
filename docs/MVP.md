# MVP implementation notes

The October 19, 2026 project plan defines everyday individual practice as the first usable release. This implementation chooses a custom Next.js modular monolith, Better Auth, Drizzle, and PostgreSQL, with PGlite for single-process local development. It keeps competitions and live target infrastructure outside this first release.

## Included product surface

- Email/password authentication with email verification and password reset; configurable Google and GitHub authentication.
- A private email allowlist enforced for protected application access, including downloads.
- A public codename for each learner, separate from private email and provider identity.
- Seven-category practice library with category, difficulty, and progress filters.
- Downloadable, versioned single-flag challenges, private artifacts, visible file metadata, and server-side flag validation.
- Persistent solves and practice XP, awarded once for the eligible completion.
- Basic draft authoring, artifact upload, review, publication, and archival with staff permissions and MFA.
- Local fictional seed content, production bootstrap commands, versioned migrations, CI, and a container deployment recipe.

The source-of-truth runtime contracts are the server validation schemas, database schema/migrations, permission checks, and tests. UI controls are convenience and feedback; they are not authorization boundaries.

## First-release decisions

| Topic | MVP choice |
| --- | --- |
| Participation | Individual practice only; no event registration or team requirement |
| Content format | Downloadable files; the platform never runs challenge targets or uploaded executables |
| Categories | The seven confirmed categories from the plan; cryptography and reverse engineering remain proposed additions |
| Challenge lifecycle | Draft → review → published; archival removes practice access |
| Review | Independent staff review and a correct test-solve flag before publication |
| Flags | Validated server-side against a keyed digest; no browser-visible answer field |
| Downloads | Authenticated endpoint reads from a private artifact directory; each request rechecks access |
| Duplicate solves | A database constraint and transactional award path prevent duplicate credit |
| Staff roles | Participant, author, reviewer, administrator; narrower event/moderation roles arrive with those features |
| Staff authentication | Authenticator enrollment plus verification in the current session for privileged actions |
| Local development | One embedded database process, generated credentials, file mailbox, fictional data |
| Production | PostgreSQL, HTTPS origin, explicit secrets, SMTP, private allowlist, durable artifacts |

Seeded challenges are examples for a development environment. Their review metadata establishes the sample workflow; it is not a substitute for human review of production content. A reviewer should independently solve every real challenge and verify that no solution or flag leaks through learner responses before publishing it.

## Production hardening gaps

These are explicit differences between the project plan and the current first implementation:

| Requirement | Current behavior | Work still required |
| --- | --- | --- |
| Hash stored session tokens | Better Auth's native adapter persists the original session token in `auth_session.token`; no supported hashing option is configured | Review and implement a supported session storage adaptation with end-to-end session, revocation, rotation, and MFA tests; restrict database and backup access meanwhile |
| Scan uploads for malware | Extension, length, and selected format signatures are checked; archives are never extracted or executed by the server | Add a quarantine/scanning service and publication gate; independently scan real artifacts before publication until integrated |
| Immutable submissions, XP, and audit records | Service code appends records and enforces award uniqueness, but the database role can still modify those tables | Separate migration and runtime database privileges, add suitable append-only database enforcement, and test direct forbidden updates/deletes |
| Complete security assessment | Focused automated tests and application controls cover selected boundaries | Run and document deployment-specific security testing; no full ASVS audit or independent penetration test is claimed |

These gaps must remain part of release preflight even when type checking, tests, and builds pass. Ad hoc hashing of Better Auth's session column would break its lookups; a production change must integrate with the library's complete session lifecycle.

The initial npm audit reported no high or critical advisories and four moderate findings along Drizzle Kit's legacy esbuild-loader dependency chain (GHSA-67mh-4wv8-2f99). The application does not start an esbuild development server or Drizzle Studio. CI fails on high/critical findings; review this tooling chain again before exposing development tools.

## Deferred scope

The following are separate roadmap work and must not be inferred from this MVP:

- Competitions, dynamic scoring, tie-breaking/replay, schedules, standings, registration, and roster locks.
- Exact-four teams, invite links, team finder, matching, study groups, and group workspaces.
- Isolated live labs, browser terminals, per-user targets, lab networking, and a lab escape threat model implementation.
- Progressive hints, assistance-aware XP, walkthrough state, private notes/bookmarks, transfer checks, variants, and a full Skill Passport.
- Learning paths, tutorials, community writeups/moderation, Campus Cases, and event debriefs.
- Automated data retention, self-service data export/deletion, and final institutional privacy notice approval.
- A production monitoring/alerting installation, offsite backup automation, a load rehearsal, or a completed independent penetration test.

No event scoring decision is needed to use this release. Introducing events later requires an explicit event-to-challenge version mapping and a scoring specification that settles the dynamic tie-break conflict identified in the project-plan review.

## Acceptance checklist

Use a fresh local database or fictional staging environment. Keep private test credentials out of screenshots and issue reports.

| Journey or boundary | Expected evidence |
| --- | --- |
| New approved learner registers | Email verification and codename onboarding lead to the practice library without a team or event |
| Unapproved identity signs in | Protected pages, API calls, and artifact access remain unavailable |
| Active access is revoked | A later protected request fails despite the existing login session |
| Learner investigates a challenge | File download requires authentication; size and checksum correspond to the downloaded file |
| Incorrect flag | Generic incorrect result; no partial-match clues or XP deduction |
| First correct flag | One completion and one XP award tied to the challenge version |
| Duplicate or concurrent correct flags | No second completion or XP award |
| Learner signs out and returns | Progress remains in the same account |
| Too many attempts | Rate limit with cooldown; no extra flag information |
| A learner guesses a draft identifier | Hidden content and its files are unavailable |
| Author saves and sends a draft to review | Content remains private until an independent reviewer submits the correct test-solve flag and approves |
| Staff session has no fresh MFA verification | Privileged action is rejected or requests verification |
| Forbidden file extension or oversized upload | Upload is rejected before publication; uploaded content is never executed |
| External provider is configured | A real provider callback works at the configured origin and respects the allowlist |
| App is rebuilt/restarted | Existing database progress and private artifact files are preserved |

Automated checks establish only the behavior those tests cover. Review the test output and run deployment checks in [DEPLOYMENT.md](DEPLOYMENT.md) before calling a private release ready for users.
