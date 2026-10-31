# Vercel staging deployment

Use a separate staging project, database, SMTP credentials, OAuth applications, and secrets. The application runs as Next.js Node.js functions. PostgreSQL holds both records and private artifact bytes; local disk copies and legacy disk fallback are automatically disabled when `VERCEL=1`.

## Before deploying

- [ ] Choose one stable HTTPS staging hostname and the exact Git revision to deploy. Use that hostname for testing, email links, and provider callbacks.
- [ ] Select the Next.js framework preset, Node.js 24, repository root, `npm ci`, and `npm run build`. Pick a function region near the database. Do not use a static export.
- [ ] Create an isolated managed PostgreSQL database. Use the provider's pooled runtime connection and required TLS settings. Keep a direct/session connection for migrations and administrative commands.
- [ ] Configure the variables below in the Vercel environment used by staging. Keep them server-only; no secret belongs in a `NEXT_PUBLIC_` variable.

| Variable | Staging value |
| --- | --- |
| `APP_URL` | Exact stable HTTPS origin, with no path, query, or fragment |
| `DATABASE_URL` | Server-side PostgreSQL runtime connection |
| `AUTH_SECRET` | Independent random secret, at least 32 characters |
| `FLAG_SECRET` | Different random secret, at least 32 characters; retain it with backups |
| `LOCAL_MAIL` | `0` |
| `SMTP_URL` | Authenticated SMTP URL supported by the mail provider |
| `MAIL_FROM` | Sender authorized by that provider |
| `ARTIFACT_LOCAL_BACKUP` | `0` (also enforced automatically on Vercel) |

Google and GitHub are optional. Enable a provider only with both its client ID and secret, then register `https://YOUR-STAGING-HOST/api/auth/callback/google` or `/github` and test the full callback. Changing the hostname requires updating `APP_URL` and the callbacks together. Other automatic deployment URLs are not additional trusted application origins.

## Migrations, existing files, and staff

Run database commands from a trusted operator checkout or release job with the **staging** configuration explicitly supplied. Existing environment variables take precedence over `.env.local`; do not accidentally target the developer database. Vercel functions have no persistent administrative shell. Keep privileged commands out of public HTTP routes and do not run migrations independently in each function or concurrently in preview builds.

1. Back up an existing staging database and its required secrets before upgrading. Set `DATABASE_MIGRATION_URL` to the direct/session staging connection, then run `npm run db:migrate` once. Apply every committed migration, including `0004_learning_progress.sql`, before directing testers to the new app.
2. If importing legacy file-only records, run `npm run db:backfill-artifacts` from a host holding their original `ARTIFACT_DIR`. Verify that each artifact has its database content and checksum. Files larger than 3 MiB must be replaced with smaller training artifacts or moved through a separately designed large-file path before this Vercel trial.
3. Deploy the reviewed revision. The build removes prohibited local-file references and independently verifies that manifests exclude `.data`, environment files, and test output. This also covers Windows tracing that can retain paths despite Next's exclusion patterns. Deploy from Git or a clean checkout; `.vercelignore` also excludes local development files from CLI uploads.
4. Register and verify the intended administrator. From the trusted checkout with staging `DATABASE_URL`, `APP_URL`, secrets, and mail configuration, run `npm run admin -- grant owner@example.com`. Run `npm run admin -- reviewer reviewer@example.com` for a different verified account. Both enroll MFA and retain their backup codes.
5. Independently test-solve and publish the three prepared [training fixtures](release-challenges/README.md). They have source-visible answers and are suitable for a usability trial, not an undisclosed ranked event. Do not run the development seed on the deployed environment.

## File and connection boundaries

The shared UI/server artifact limit is **3 MiB**. Multipart uploads and buffered downloads stay below Vercel's documented [4.5 MB function payload limit](https://vercel.com/docs/functions/limitations). Supporting larger artifacts needs a private object-storage upload/download design; increasing a Next.js body setting does not change the platform limit.

Vercel has a [read-only filesystem with temporary scratch space](https://vercel.com/docs/functions/runtimes). The app never depends on scratch space for artifacts. PostgreSQL backups include `artifact_contents`; keep copies off the database host and perform a deployed restore drill. On persistent self-hosted deployments, local copies remain enabled unless `ARTIFACT_LOCAL_BACKUP=0`.

Each Vercel instance reuses a pool capped at three PostgreSQL connections, with a five-second idle timeout and ten-second acquisition timeout. The official `attachDatabasePool` helper handles idle connections before suspension. These limits are per instance, so use the provider pooler and check aggregate connection usage with several simultaneous testers. See [Vercel connection pooling](https://vercel.com/kb/guide/connection-pooling-with-functions).

Production auth requires one valid `X-Real-IP`. Vercel [supplies this request header](https://vercel.com/docs/headers/request-headers#x-real-ip). Verify sign-in, MFA, and callbacks on the actual staging hostname, including throttling when a client attempts to spoof forwarding headers. Keep the existing origin and IP checks enabled.

## Before inviting testers

- [ ] Record the deployed revision, HTTPS URL, date, and observed results in [the release rehearsal](RELEASE_REHEARSAL.md).
- [ ] Register a fictional player, receive real verification/reset mail, sign in/out, reset the password, and test every enabled OAuth callback. Confirm the development mailbox is unavailable.
- [ ] Choose a codename, download an artifact and verify its SHA-256, submit wrong/correct/repeated flags, reach a cooldown, and return to the same saved points after signing out.
- [ ] Confirm players cannot access drafts or staff routes; unverified and suspended accounts cannot use protected operations. Restore account access and recheck email verification.
- [ ] Test staff MFA and a backup code, draft changes and file removal, independent review, and locked published content. Confirm an author cannot publish their own challenge.
- [ ] Check resources and practice on mobile and desktop. Verify learning progress across two devices, guest import, offline retry, and separation from another account and signed-out views.
- [ ] If competitions are part of the trial, test join/start/end boundaries, private files, event points separate from practice XP, and published settings locks.
- [ ] Redeploy, then verify existing login, learning progress, points, and protected downloads remain available.
- [ ] Back up staging and restore into a separate database/environment with the original secrets. Verify a fresh login, saved solve, learning progress, and protected download. Local synthetic recovery evidence does not complete this check.
- [ ] Review function/database/mail logs and confirm connection usage stays within the provider's limits. Give two or three selected testers a feedback/contact route; record actual feedback separately from automated checks.

Retain the prior deployment and a compatible backup. Reverting a Vercel deployment does not reverse a database migration. See [deployment and recovery](DEPLOYMENT.md) for general recovery requirements.
