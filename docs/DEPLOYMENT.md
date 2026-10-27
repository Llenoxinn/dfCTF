# Deployment and recovery

The first deployment target is one long-running Node.js application with PostgreSQL and a persistent artifact directory. Embedded PGlite is for a single local development process. Ephemeral function hosting does not preserve the MVP's artifact directory.

Use fictional data on staging. Keep staging and production databases, artifact volumes, email credentials, OAuth applications, and secrets separate.

## Configure production

Install Docker Engine with the Compose plugin on the host. Copy `.env.example` to `.env.production` and edit it before starting any service. This file is ignored by Git and by the Docker build context.

Required settings:

| Variable | Production value |
| --- | --- |
| `APP_URL` | Exact public HTTPS origin, such as `https://ctf.example.edu`; no trailing path |
| `AUTH_SECRET` | Unique cryptographically random secret, at least 32 characters |
| `FLAG_SECRET` | Different cryptographically random secret, at least 32 characters; preserve it with the database |
| `LOCAL_MAIL` | `0` |
| `SMTP_URL` | Your authenticated SMTP connection URL |
| `MAIL_FROM` | Sender authorized by your email provider |
| `POSTGRES_DB` | `dfctf`, or a dedicated database name |
| `POSTGRES_USER` | `dfctf`, or a dedicated database account |
| `POSTGRES_PASSWORD` | Long random URL-safe password; the Compose connection string embeds this value |

Generate each secret independently. This PowerShell-compatible command prints one 32-byte random hex value:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Use three distinct values for `AUTH_SECRET`, `FLAG_SECRET`, and `POSTGRES_PASSWORD`. Keep them in the host secret store or a restricted environment file. Never use local fallback secrets in a deployment. Losing or changing `FLAG_SECRET` makes existing flag digests unusable; changing `AUTH_SECRET` affects existing authentication material and should be treated as a planned rotation.

Compose sets `DATABASE_URL` to its internal PostgreSQL service and mounts `ARTIFACT_DIR` at `/app/.data/artifacts`. For managed PostgreSQL or another orchestrator, set `DATABASE_URL` directly and attach a persistent, private volume to `ARTIFACT_DIR`. Follow the database provider's TLS configuration. The runtime must be able to write that directory as the unprivileged `node` user (UID 1000).

Optional Google and GitHub credentials use the names in `.env.example`. Their callbacks are:

```text
https://YOUR-HOST/api/auth/callback/google
https://YOUR-HOST/api/auth/callback/github
```

## Build, migrate, and start

All schema changes ship as reviewed Drizzle migrations. Use the migration CLI below; no Supabase SQL Editor or hand-applied table changes are required. `DATABASE_MIGRATION_URL` can supply a dedicated migration connection and otherwise defaults to `DATABASE_URL`.

For Supabase-hosted PostgreSQL, use the direct connection for migrations, or its session pooler when the deployment network is IPv4-only. Copy the exact connection from its Connect dialog and keep it server-side. See [Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres). This app uses a backend table-owner connection and denies direct browser table access through row-level security; see [architecture](ARCHITECTURE.md).

From the repository checkout on the deployment host:

```powershell
docker compose --env-file .env.production build app
docker compose --env-file .env.production up -d database
docker compose --env-file .env.production run --rm app npm run db:migrate
docker compose --env-file .env.production up -d app
docker compose --env-file .env.production logs --tail 100 app
```

Migrations must succeed before the app is started. Run a single migration process; do not run schema changes concurrently with another deployment. Review generated SQL before shipping it. Back up PostgreSQL and artifacts before a schema or content migration.

The Docker image runs as `node`, retains the source and CLI dependencies needed for migrations and administrative bootstrap, and binds port 3000 inside its container. Compose publishes that port only to the host's loopback interface. Place a TLS reverse proxy on the host in front of `127.0.0.1:3000`, preserve the public host, and set the forwarded protocol to HTTPS. Set a request body limit that accommodates the documented artifact limit, plus multipart overhead, while rejecting oversized uploads. Prevent unauthenticated access to any development services.

The Compose database has no public host port. Its health check gates app startup. The `postgres-data` and `artifact-data` named volumes survive normal container replacement. Do not run `docker compose down --volumes` against a deployment you need to keep.

## Bootstrap the first administrator

Do not run `npm run seed` on production. It intentionally refuses to create demo accounts there.

1. Visit the HTTPS application, register the intended administrator's email, and complete the verification email. Registration is open; no approval command is needed. Confirm that real SMTP delivery works and choose a codename.
2. Promote the verified account:

   ```powershell
   docker compose --env-file .env.production exec app npm run admin -- grant owner@example.edu
   ```

3. Sign in as that administrator, enroll an authenticator, and complete the staff verification prompt; [staff setup](STAFF.md) explains each screen. Ordinary players need only register and verify their email. Grant staff roles only to trusted maintainers; admins can suspend or restore account access in Settings. Give a second maintainer reviewer access with `npm run admin -- reviewer <email>`, using the same `docker compose ... exec app` prefix.
4. Create a draft, upload a fictional artifact, and use a separate reviewer account to review it. The reviewer must submit the correct test-solve flag to publish it. Confirm a participant can access the published challenge and cannot access drafts.

Administrative shell access is privileged access to the application's database. Limit who can run these commands and keep a record of production bootstrap operations.

## Release checks

Run `npm run check` on the exact revision you intend to deploy. Then complete these checks against staging with its real deployment configuration:

- Registration, verification email, sign-in, password reset, and sign-out work through the public HTTPS origin.
- Every configured external provider completes its callback and returns to the same account correctly. Test this with real test-provider credentials; mocked or local credential tests do not establish it.
- A new player can register without prior approval. Unverified email cannot reach protected pages, APIs, or artifacts. Suspend an active account and check that its next protected request fails; restoring access must preserve email-verification requirements.
- A learner chooses a codename, solves a challenge, leaves, returns, and sees one completion and the same XP.
- Two simultaneous correct submissions award one completion and one reward. Repeated incorrect submissions return a visible cooldown.
- Authors cannot publish their own drafts through the reviewer flow or edit another author's drafts; publication requires a different reviewer and a correct test-solve flag. Nonstaff accounts cannot invoke privileged operations. Staff actions require current-session MFA verification.
- Upload limits and allowed extensions are enforced; private artifacts download as attachments and their listed checksums match. Published files remain available after app container replacement.
- Email is sent through production SMTP; `.data/mail` and the development mailbox API are unavailable.
- Logs and error responses contain no flag answers, submitted flags, passwords, OAuth codes, or session tokens.
- Competition-only challenges remain unavailable through practice routes, public counts, and file URLs. An unregistered or early player cannot open them; a registered player can at the start boundary, and submissions close at the end boundary. Event points do not change practice XP.
- Administrator event settings require current staff MFA. Published schedules and point values stay locked. Test any configured CTFd HTTPS link and its independent host registration flow.
- A backup can be restored to an isolated host with the required secrets, and a known account's practice progress and artifacts still work.

For the first shared deployment, confirm real email delivery, account suspension, a challenge download, and backup restoration. Provide a way for players to contact the maintainer about account or data requests. Record which integrations and controls were actually tested.

Keep these limitations visible for the deployment:

- Better Auth persists native session tokens in `auth_session.token`. Restrict database and backup access. Keep the supported authentication integration; do not hash this column ad hoc or build a custom adapter solely to satisfy an old plan. The authentication library uses it for session lookup.
- Upload checks enforce extensions, size, and selected file signatures; there is no antivirus or malware scanning integration. A valid signature does not establish that a PDF or archive is safe. Keep author uploads trusted, independently scan every real artifact before publication, and implement a quarantine/scanning gate before accepting untrusted author content.
- Submission, points, and audit records follow append-only service conventions. The runtime database role has not yet been restricted with separate migration/runtime grants or database rules that prevent record modification. Restrict privileged database access and keep backups; do not describe the ledgers as tamper-resistant.

These limits are recorded in the [side project plan](MVP.md#production-hardening-gaps) so they remain visible during later release work.

## Back up and restore

Back up PostgreSQL, the artifact volume, and the required deployment secrets. Database-only backups do not preserve downloadable files, and artifacts without the database do not preserve access metadata or progress. Keep encrypted copies off the application host and restrict access to both the backup data and secrets.

Choose a backup mechanism for the target host that produces a consistent PostgreSQL dump or uses PostgreSQL-aware backups. Avoid PowerShell text redirection for binary custom-format dumps. Take a consistent artifact snapshot during a write pause or with a snapshot-capable volume, and record the app revision and migration version beside each backup.

A restore drill must use a separate database and artifact directory. Restore the database and files, provide the original `FLAG_SECRET` and any required authentication secrets, start the matching application revision, and verify login, progress, and a protected download. Upgrade only after that restore works. Automating backups and monitoring their success is deployment work, not functionality provided by this Compose file.

## Update and rollback

For each release, preserve the current image/revision and a restorable backup, build the replacement, apply its reviewed migrations once, and restart the app. Check authentication, a protected download, and existing progress after deployment.

Rolling back the image does not reverse schema changes. Use backward-compatible migrations whenever possible. If a migration is incompatible with the earlier application, restore the database and artifact snapshot together under a maintenance window, with an explicit decision about data written since that backup.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Local PGlite lock or unexpected database errors | Stop other app/CLI processes using `.data/postgres`; use PostgreSQL for multiple processes |
| OAuth returns to the wrong host | `APP_URL`, browser origin, exact provider callback, proxy host and forwarded HTTPS headers |
| Google/GitHub button is absent | Both client ID and secret for that provider must be set; restart after changing them |
| Verification email does not arrive locally | `LOCAL_MAIL=1` and the files in `.data/mail` |
| Verification email does not arrive on staging/production | SMTP connection, sender authorization, provider logs, and outbound network policy |
| Production refuses configuration | HTTPS `APP_URL`, PostgreSQL URL, distinct real secrets, SMTP, sender, and disabled local mail |
| Container starts but the host cannot connect | Use the included Docker command that overrides Next's hostname to `0.0.0.0`; inspect app logs |
| File is missing after redeployment | Persistent `ARTIFACT_DIR` mount and filesystem permissions for UID 1000 |
| Artifact digest or accepted flag changes unexpectedly | Correct artifact backup and the original `FLAG_SECRET`; never replace the database with the local seed |
