# dfCTF side project plan

Build a CTF platform that one maintainer can understand, test, and run. The first release focuses on solving challenges, saving progress, and comparing scores. Keep the existing Next.js application, authentication library, database, and file storage.

## Current scope

| Area | Implemented behavior |
| --- | --- |
| Registration | Anyone can register; email verification is required before protected access. No invite or university-domain requirement |
| Identity | Public codenames; email and provider identity remain account information |
| Challenges | Seven categories, three difficulties, filtering, downloadable files, and a single flag per version |
| Scoring | Server-side validation; first eligible solve awards points once per family; wrong answers cost nothing |
| Progress | Persistent solve history and unlocked walkthroughs |
| Community | Weekly and all-time standings, recent solves, first-blood labels, and activity charts |
| Challenge solvers | Full completion list by public codename and Philippine time; one first-blood attribution, without bonus points |
| Rules / Mechanics | Public fair-play rules and a hidden-flag reading challenge; no LLM-assisted solving, platform abuse, or plagiarized challenges |
| Competitions | Admin-created built-in events or CTFd host links; configurable schedules, notes, and native fixed points; separate registrations, submissions, solves, and scoreboards |
| Event privacy | Reviewed competition-only challenges stay out of practice; registered players gain access at the start; submissions close at the end |
| Weekly feature | Latest published challenge tagged `weekly`, during its publication week only; publishing is manual |
| Authoring | Draft → review → published → archived. Authors or admins can return review to draft for corrections |
| Permissions | Author, reviewer, admin; independent test-solve before publication; staff MFA |
| Moderation | Admins suspend and restore access; suspensions apply to existing sessions and future sign-ins |
| Development | Embedded PGlite, fictional seed content, generated local credentials, and a file mailbox |
| Delivery | Type checks, automated tests, browser regressions, and production build in CI |

The source of truth is the validation schemas, database constraints, server permission checks, and tests. UI controls do not replace authorization.

## Next small release

- [x] Describe dfCTF as a CTF side project and document what actually exists.
- [x] Open registration to verified emails while preserving suspensions and staff permissions.
- [x] Show a recoverable error when landing-page statistics fail instead of presenting the failure as zero activity.
- [x] Run browser regressions in CI alongside the existing checks.
- [ ] Try the full player and staff flows on a staging deployment with fictional data.
- [ ] Confirm verification and password-reset emails arrive through the configured SMTP provider.
- [ ] Restore a backup of the database and challenge files, then verify a saved solve and download.
- [ ] Publish a small set of reviewed challenges and collect feedback from initial players.

Finish these checks before expanding the product. Success means a player can join, verify their email, solve a challenge, return later with the same points, and find another challenge worth opening.

## Keep maintenance small

- Use one application and PostgreSQL for records and private artifact contents. Vercel uses database-only storage; persistent hosts can keep local backup copies. PGlite remains a single-process local option. Follow the [Vercel staging checklist](VERCEL.md) for the first serverless trial.
- Keep the existing auth and access checks. The legacy `allowlist` table and routes now track account access and suspensions; a new table or data migration is unnecessary.
- Promote the initial administrator through the existing server command. Staff-role management UI can wait.
- Use manual challenge publication. Add scheduling only if maintaining a schedule becomes a real need.
- Add a regression test for a reproduced bug. Avoid speculative abstractions and new dependencies.

## Release checks

Use fictional accounts and data. See [deployment and recovery](DEPLOYMENT.md) for host setup and backup instructions.

- A new email can register without prior approval; unverified email cannot access challenges or downloads.
- A verified player can choose a codename, download a published file, submit a flag, and return to saved progress.
- Duplicate and concurrent correct submissions award one solve and one eligible points entry.
- Suspended accounts cannot use protected APIs, downloads, account-management operations, or new sign-ins. Restoring access preserves email-verification requirements.
- Players cannot access drafts or staff tools. Staff need fresh MFA; an author cannot publish their own challenge.
- Review can return to draft for corrections; publishing locks the content and files.
- Weekly selection and standings use Philippine time and expire at the correct boundary.
- Failed data requests show an error with a way to recover.
- Production SMTP works. Test external OAuth only for providers enabled in the deployment.
- Restarting the app preserves the database and artifacts; a separate restore drill succeeds.

## Production hardening gaps

Keep these limits visible without turning the side project into an enterprise rewrite:

| Limit | Practical boundary now | Revisit when |
| --- | --- | --- |
| No malware-scanning integration | Only trusted staff upload files; inspect and scan real artifacts before publishing. Downloads are attachments, and the server never executes or extracts them | Accepting untrusted challenge authors |
| Native auth session tokens are stored by Better Auth | Restrict database and backup access. Do not change the token column or invent a custom auth adapter just to satisfy an old plan | A concrete deployment requirement calls for a reviewed storage change |
| Scoring and audit records are append-only through application code, not protected from a database administrator | Restrict privileged database access; keep backups and transactional scoring checks | More operators or a stronger audit requirement |
| No self-service account export or deletion | Provide a way to contact the maintainer for account and data requests | Real users request a self-service workflow |
| Production integrations are environment-dependent | Verify SMTP, configured OAuth providers, and backup restoration on staging | Before sharing that deployment |

Passing tests proves the covered behavior. It does not certify security, validate an external provider, or establish that a backup can be restored.

## Later, only if needed

Teams, dynamic scoring, live target hosting, native paid hints, learning paths, social features, and a Skill Passport remain separate projects. Choose the next small task from actual player feedback.
