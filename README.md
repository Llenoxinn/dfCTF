# dfCTF

A capture-the-flag (CTF) platform built as a side project. Anyone can register, verify their email, choose a codename, solve challenges, and earn points on the weekly and all-time leaderboards.

The application is a custom Next.js modular monolith with React, Better Auth, Drizzle, and PostgreSQL. Development can use embedded PGlite without installing a database server. PostgreSQL stores account records, challenge data, and private artifact contents; persistent hosts can also keep local backup copies. [Architecture and invariants](docs/ARCHITECTURE.md) describe authentication, event isolation, scoring, and database ownership.

See the [side project plan](docs/MVP.md) for current scope, the next small release, and known limitations. [PRODUCT.md](PRODUCT.md) describes the product and its constraints.

To report a bug, suggest a feature, or flag a visual UI problem, follow the [contributing and issue template guide](.github/CONTRIBUTING.md).

## Run locally

Install Node.js 24 and npm. From this directory in PowerShell:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run db:migrate
npm run seed
Get-Content .data/bootstrap.txt
npm run dev
```

Open [dfCTF on localhost](http://127.0.0.1:3000). Use the exact `127.0.0.1` origin shown here; session cookies and authentication callbacks belong to the configured origin.

`seed` creates eight reviewed practice challenges, including **Read the fine print**, and development accounts with freshly generated passwords. Their credentials are written only to the ignored `.data/bootstrap.txt` file. The seed is for local development; it refuses to run in production. Do not share that file, use its accounts with real students, or copy the local database into production.

With `DATABASE_URL` empty, data lives in `.data/postgres`, artifact backup copies in `.data/artifacts`, and development emails in `.data/mail`. With a PostgreSQL URL configured, account records, challenge data, and artifact contents use that database. Stop the development server before running a database CLI against embedded PGlite: only one application process may open that database directory at a time. Use PostgreSQL when running multiple app processes. Keep `.data` between restarts to retain local backups and fallback secrets.

The app and database scripts load `.env.local`. Leave `LOCAL_MAIL=1` for local development. Registration and password reset messages are saved as JSON in `.data/mail`; open the latest message to follow its verification or reset link. The development mailbox endpoint, `GET /api/v1/auth/local-mail`, is loopback-only and unavailable in production. No email is delivered externally in this mode.

## Try the learner flow

1. Sign in with the generated learner account, or register with any email address. New accounts must verify their email before accessing challenges; no prior approval is needed.
2. Choose a public codename when prompted. Provider names and email addresses do not become public codenames automatically.
3. Open the practice library and filter by category, difficulty, or solve status.
   Press `/` outside an editable field to focus the visible library search. Press Escape in search to clear it.
4. Open a challenge, read the objective, and download any files it comes with. Each file shows its size; staff see SHA-256 checksums in Authoring to confirm an upload.
5. Investigate the fictional artifact and submit a complete `dfCTF{...}` flag. Validation happens on the server. Incorrect attempts do not deduct points; a cooldown appears when the attempt limit is reached.
6. A first solve records the challenge version, awards its practice XP once, and unlocks the explanation. The challenge's **Solvers** tab lists every solver in completion order, with the first blood highlighted and timestamps in Philippine time. Sign out and back in to confirm that progress remains.

Open **Rules / Mechanics** from the public site or the signed-in Rules tab. The rules prohibit LLM-assisted solving, attacks or abuse of the platform, answer sharing, and plagiarized challenges. Three field notes form the flag for **Read the fine print**. Re-run `npm run seed` with the local app stopped to add it to an existing development database. On a deployment, staff can choose **Authoring → Rules challenge** to create its draft and briefing file, then use the usual independent review and publication flow.

Open **Resources** from the navigation or tools FAQ for the public [Tutorials & Resources library](http://127.0.0.1:3000/resources), or use the signed-in Resources tab. Search its 15 topics and tool guides (grouped as Beginner or Intermediate), filter by starting level or stated platform, or follow one of six learning paths. Each topic has its own page with learning goals, optional prerequisites, previous/next navigation, and a gradual order: introduction, basic ideas, a first skill, recommended tools, deeper guides, a recap, then optional practice. **Mark topic read** sits at the end of each topic. The topic index uses the LineSidebar. Click underlined technical terms for plain-language explanations. Commands and exercises stay collapsed until requested.

After you start reading, **Your learning** replaces the welcome panel at the top of the library: the topic you were reading and the section you stopped at, your current path, topics marked read, bookmarks, and where progress is saved. Each learning path shows which topics are read, which one you are reading, and which comes next.

Anonymous reading progress stays in the browser. Signed-in users sync reading sections, open guides, topic/tool bookmarks, and topics marked read through the account-scoped `/api/v1/learning/progress` endpoint. Cached changes wait for retry when offline, and field updates merge under a database row lock. Local account caches are separate from anonymous progress and other accounts; importing anonymous progress is an explicit action. Expired or changed sessions hide account progress and block further edits until identity is verified. Marking a topic read is a personal checklist, not a scored assessment. Reading remains public without browser storage. Apply migration `0004_learning_progress` with `npm run db:migrate` before deploying account sync.

Legacy topic/tool fragment links redirect to their new pages. Content lives in `src/lib/resources.ts` and `src/lib/resource-specialties.ts`; learning paths and glossary live in `src/lib/resource-learning.ts`, and learning goals, prerequisites, and recaps live in `src/lib/resource-lesson-plan.ts`. Use original examples and verify official references when updating guides. These guides teach tools without providing answers to dfCTF challenges.

The library covers General skills, OSINT, Steganography, Forensics, Web exploitation, Binary exploitation, and Miscellaneous. MVP web and binary exercises use downloadable material; they do not launch vulnerable services or execute uploaded content.

## Try the staff flow

Weekly standings run Monday 00:00 through Sunday 23:59:59.999 in **Asia/Manila**, regardless of the server or browser timezone. A published challenge tagged `weekly` is featured only during its publication week; when several qualify, the most recently published challenge is featured. Old challenges remain in the library without receiving a new weekly deadline.

Use the generated owner account for local administration. Privileged author, reviewer, and administrator actions require two-factor authentication and verification in the current session. Set up an authenticator in Settings before using Authoring or administrative tools; [staff setup](docs/STAFF.md) walks through it step by step. A fresh sign-in or expired staff grant requires verification again; the staff grant lasts at most 12 hours.

Authors create and edit their own drafts, add an intended solution and flag, and upload files when the challenge needs them. Challenges without files, such as many OSINT puzzles, can go through review too. A draft enters review before publication. A different eligible reviewer checks the content and submits the correct flag to approve publication. Participants can see and download only published content. Administrators manage access in Settings; the server checks permissions for each operation. The CLI grants administrator or reviewer access, while a general staff-role management interface remains future work.

The description toolbar supports bold, italic, underline, strikethrough, headings, lists, quotes, links, and code. Select text before choosing a style; Ctrl/Cmd+B, I, and U also work. **Preview** uses the same formatting players see. Descriptions remain editable text with Markdown formatting (underline uses `<u>text</u>`); summaries show plain text, and unsafe HTML is removed when rendering.

If review finds a problem, the author or an administrator can choose **Return to draft**, correct and save the challenge, then send it for independent review again. Published versions stay locked. Staff who already enrolled an authenticator can use a saved backup code in Settings to verify a new or expired session; each code works once.

The editor asks before discarding unsaved challenge edits when you leave, navigate, or reload. Draft authors and administrators can remove an uploaded file from an unlocked draft, then upload its replacement. Removal takes effect immediately and preserves other unsaved edits. Files in review or published versions stay locked; return a review to draft before changing its files.

Artifact uploads accept `.txt`, `.csv`, `.json`, `.log`, `.pcap`, `.zip`, `.png`, `.jpg`, `.jpeg`, and `.pdf` files, up to 3 MiB per file. Private file contents are stored in the database and served through an authenticated download endpoint. Local development and persistent hosts also keep backup copies; Vercel automatically uses database-only storage. Other hosts can set `ARTIFACT_LOCAL_BACKUP=0` to disable disk copies and legacy disk fallback. Backfill older file-only records before disabling disk storage. Files are never extracted or executed by the application. Extension and signature checks are implemented; malware scanning is not integrated.

## Host a competition

Open **Competitions → Manage events → Create competition** as an administrator with a verified staff session. Choose **Built-in dfCTF** or **CTFd host link**, then customize the title, description, event notes, and start/end times. Schedule fields use Philippine time (UTC+8).

For a built-in event, create original challenges in Authoring with **Availability → Competition only**. A different reviewer must test-solve and publish them before the host can select them and assign event points. These challenges stay out of practice and can belong to one event. Publish the event when its settings are ready; the schedule, challenge selection, and points then stay locked.

Players join a published built-in event before or during play. Registered players can open its challenge details and files when it starts. New submissions and registrations close exactly at its end time; registered players retain access to results and challenge review. Event points, first blood, and standings are separate from practice XP. The scoreboard refreshes every 30 seconds while the event is open and supports manual refresh.

For a CTFd event, provide the existing host’s HTTPS URL. Its own site handles registration, challenges, hints, and scoring. Administrators can archive an event to withdraw access. Apply database migrations before running the updated application.

## Manage account access

Registration is open to verified emails. New accounts are tracked automatically so an administrator can suspend or restore access in Settings. To suspend an account from an administrative shell:

```powershell
npm run admin -- revoke person@example.edu
```

To restore access:

```powershell
npm run admin -- allow person@example.edu
```

Restoring access does not skip email verification. To bootstrap an administrator, first register and verify the account, then run:

```powershell
npm run admin -- grant person@example.edu
```

To let someone test-solve and publish challenges without full administrator access, make their verified account a reviewer. The command refuses administrator accounts, which can already review:

```powershell
npm run admin -- reviewer person@example.edu
```

Run database CLIs with the local app stopped when using PGlite. On a deployment, run these commands inside the app container; see [deployment](docs/DEPLOYMENT.md).

## Configure social sign-in

Email/password sign-in works locally without provider credentials. Google and GitHub buttons appear in the sign-in form and become available when that provider's client ID and client secret are configured. Register an OAuth application with the selected provider and configure the matching pair in `.env.local` or the deployment's secret store:

| Provider | Variables | Callback for this local setup |
| --- | --- | --- |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `http://127.0.0.1:3000/api/auth/callback/google` |
| GitHub | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | `http://127.0.0.1:3000/api/auth/callback/github` |

For a deployment, replace `http://127.0.0.1:3000` with the exact HTTPS `APP_URL`. Configure each provider with that exact callback and restart the app after changing credentials. Use separate OAuth applications and secrets for local, staging, and production environments. Email verification and account suspensions apply to every sign-in route. Account linking must be initiated while signed in; matching email addresses do not silently merge accounts.

Provider configuration is included, but a real social sign-in round trip requires your own provider applications and credentials. Do not treat a successful local credentials sign-in as validation of those external flows.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server on `127.0.0.1:3000` |
| `npm run db:migrate` | Apply the versioned database migrations |
| `npm run db:backfill-artifacts` | Copy legacy artifact files into the configured database after migrations; verify checksums and keep local copies |
| `npm run db:generate` | Generate migrations after changing the Drizzle schema |
| `npm run seed` | Create local fictional content and generated demo credentials |
| `npm run admin -- allow <email>` | Restore account access; email verification is still required |
| `npm run admin -- revoke <email>` | Suspend account access, including existing sessions |
| `npm run admin -- grant <email>` | Promote an existing verified account to administrator |
| `npm run admin -- reviewer <email>` | Make an existing verified account a reviewer |
| `npm run typecheck` | TypeScript validation |
| `npm test` | Automated tests |
| `npm run test:browser` | Browser regression tests against the production build (Edge on Windows; Playwright Chromium elsewhere) |
| `npm run test:integration` | Real local player flow with isolated app, database, files, and mailbox on port 3200 |
| `npm run build` | Build the production application |
| `npm run verify:build` | Check an existing build's file manifests for private local data and test output |
| `npm start` | Run a previously built application |
| `npm run check` | Type checking, tests, and production build |

CI installs the locked dependencies and runs type checking, tests, the production build, and browser regressions in Chromium. Deployment credentials are not required to compile the application; production runtime configuration is checked when server services are used. Never use bypass values to run a production service.

Run `npm run build` before `npm run test:browser`. The browser suite starts a separate server on `127.0.0.1:3100` and uses mocked accounts and uploads; it does not modify the application database. Windows uses the installed Microsoft Edge browser; other systems need Playwright's Chromium browser.

`npm run test:integration` starts its own temporary development app and fictional challenge on `127.0.0.1:3200`. It exercises real registration, local verification/reset emails, downloads, concurrent scoring, and returning progress, then removes its temporary data. It uses Edge on Windows or Playwright Chromium elsewhere and can run beside the normal local app. See [local validation and remaining staging checks](docs/LOCAL_VALIDATION.md).

## Deploy and review scope

See [Vercel staging](docs/VERCEL.md) for the serverless testing checklist, or [deployment and recovery](docs/DEPLOYMENT.md) for Docker, PostgreSQL, TLS, administrator bootstrap, email, backups, and release checks.

The current release includes practice, individual timed competitions, progress, leaderboards, and the Tutorials & Resources library with its learning paths. Those paths are reading guides, not graded courses. Teams and live targets remain future work. Before sharing a deployment, verify email delivery, access revocation, and backup restoration, and review the [known limitations](docs/MVP.md#production-hardening-gaps). Tests and a successful build do not certify security or validate external services.
