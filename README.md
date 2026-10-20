# dfCTF

A private capture-the-flag practice platform. This first release implements the MVP from the October 19, 2026 project plan: controlled sign-in, a codename, a reviewed library of downloadable challenges, server-side flag validation, persistent progress, and staff authoring.

The application is a custom Next.js modular monolith with React, Better Auth, Drizzle, and PostgreSQL. Development can use embedded PGlite without installing a database server. Production uses a PostgreSQL service and persistent private artifact storage.

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

`seed` creates seven fictional, reviewed practice challenges and development accounts with freshly generated passwords. Their credentials are written only to the ignored `.data/bootstrap.txt` file. The seed is for local development; it refuses to run in production. Do not share that file, use its accounts with real students, or copy the local database into production.

With `DATABASE_URL` empty, data lives in `.data/postgres`, artifacts in `.data/artifacts`, and development emails in `.data/mail`. Stop the development server before running a database CLI against embedded PGlite: only one application process may open that database directory at a time. Use PostgreSQL when running multiple app processes. Keep `.data` between restarts to retain progress and local secrets.

The app and database scripts load `.env.local`. Leave `LOCAL_MAIL=1` for local development. Registration and password reset messages are saved as JSON in `.data/mail`; open the latest message to follow its verification or reset link. The development mailbox endpoint, `GET /api/v1/auth/local-mail`, is loopback-only and unavailable in production. No email is delivered externally in this mode.

## Try the learner flow

1. Sign in with the generated learner account, or allowlist another email and register it. New email/password accounts must verify their email before accessing practice.
2. Choose a public codename when prompted. Provider names and email addresses do not become public codenames automatically.
3. Open the practice library and filter by category, difficulty, or solve status.
4. Open a challenge, read the objective, and download its file. File sizes and SHA-256 checksums are shown alongside the download.
5. Investigate the fictional artifact and submit a complete `dfctf{...}` flag. Validation happens on the server. Incorrect attempts do not deduct XP; a cooldown appears when the attempt limit is reached.
6. A first solve records the challenge version, awards its practice XP once, and unlocks the explanation. Sign out and back in to confirm that progress remains.

The library covers General skills, OSINT, Steganography, Forensics, Web exploitation, Binary exploitation, and Miscellaneous. MVP web and binary exercises use downloadable material; they do not launch vulnerable services or execute uploaded content.

## Try the staff flow

Use the generated owner account for local administration. Privileged author, reviewer, and administrator actions require two-factor authentication and verification in the current session. Set up an authenticator in Settings before using Authoring or administrative tools. A fresh sign-in or expired staff grant requires verification again; the staff grant lasts at most 12 hours.

Authors create and edit their own drafts, add an intended solution and flag, and upload artifacts. A draft enters review before publication. A different eligible reviewer checks the content and submits the correct flag to approve publication. Participants can see and download only published content. Administrators manage private access in Settings; the server checks permissions for each operation. The bootstrap CLI grants administrator access, while a general staff-role management interface remains future work.

Artifact uploads accept `.txt`, `.csv`, `.json`, `.log`, `.pcap`, `.zip`, `.png`, `.jpg`, `.jpeg`, and `.pdf` files, up to 10 MiB per file. Files are stored outside the public web directory and served through an authenticated download endpoint. They are never extracted or executed by the application. Extension and signature checks are implemented; malware scanning is not integrated.

## Manage private access

Add an email to the allowlist from an administrative shell:

```powershell
npm run admin -- allow person@example.edu
```

The person can then register, verify their email, and choose a codename. To bootstrap an administrator after that account has been verified:

```powershell
npm run admin -- grant person@example.edu
```

Run database CLIs with the local app stopped when using PGlite. On a deployment, run these commands inside the app container; see [deployment](docs/DEPLOYMENT.md).

## Configure Google and GitHub

Email/password sign-in works locally without provider credentials. Google and GitHub buttons appear only when that provider's client ID and client secret are configured. Register an OAuth application with the selected provider and configure the matching pair in `.env.local` or the deployment's secret store:

| Provider | Variables | Callback for this local setup |
| --- | --- | --- |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `http://127.0.0.1:3000/api/auth/callback/google` |
| GitHub | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | `http://127.0.0.1:3000/api/auth/callback/github` |

For a deployment, replace `http://127.0.0.1:3000` with the exact HTTPS `APP_URL`. Configure each provider with that exact callback and restart the app after changing credentials. Use separate OAuth applications and secrets for local, staging, and production environments. The allowlist applies to every sign-in route; a valid provider account alone does not grant practice access. Account linking must be initiated while signed in; matching email addresses do not silently merge accounts.

Provider configuration is included, but a real Google/GitHub round trip requires your own provider applications and credentials. Do not treat a successful local credentials sign-in as validation of those external flows.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server on `127.0.0.1:3000` |
| `npm run db:migrate` | Apply the versioned database migrations |
| `npm run db:generate` | Generate migrations after changing the Drizzle schema |
| `npm run seed` | Create local fictional content and generated demo credentials |
| `npm run admin -- allow <email>` | Add an email to the private access allowlist |
| `npm run admin -- grant <email>` | Promote an existing verified account to administrator |
| `npm run typecheck` | TypeScript validation |
| `npm test` | Automated tests |
| `npm run build` | Build the production application |
| `npm start` | Run a previously built application |
| `npm run check` | Type checking, tests, and production build |

CI installs the locked dependencies and runs type checking, tests, and the production build. Deployment credentials are not required to compile the application; production runtime configuration is checked when server services are used. Never use bypass values to run a production service.

## Deploy and review scope

See [deployment and recovery](docs/DEPLOYMENT.md) for Docker, PostgreSQL, TLS, production bootstrap, email, backups, and release checks. See [MVP implementation notes](docs/MVP.md) for product decisions, deferred features, and the acceptance checklist.

This is a private practice MVP. It does not include competitions, event standings, teams or matching, live labs, learning paths, or a complete Skill Passport. Before onboarding real students, address the [documented production hardening gaps](docs/MVP.md#production-hardening-gaps), privacy operations, operational monitoring, and external OAuth verification. The repository is not a claim of ASVS certification or a completed penetration test.
