# Local validation

Run these checks from the repository root:

```text
npm run check
npm run test:browser
npm run test:integration
npm run test:recovery
node docs/release-challenges/verify.mjs
```

`check` runs TypeScript validation, unit tests, and the production build. Browser regressions run against that build on `127.0.0.1:3100`, with mocked API responses. Windows uses installed Microsoft Edge; other platforms use Playwright Chromium.

The integration suite starts the real application on `127.0.0.1:3200`. It copies application sources and build configuration into a separate temporary folder and links the installed dependencies. It does not copy `.env.local`, the developer database, artifacts, mailbox, or local credentials. Each run uses a separate PGlite database, private artifact files, local email, and randomly generated auth and flag secrets.

The helper creates its temporary folder beside the checkout, refuses populated folders, and writes a unique ownership marker before creating fixtures. The test app uses Turbopack with that parent as its explicit root, so linked dependencies stay inside the root and Webpack's development-manifest rewrite race does not affect these tests. Cleanup runs in the test reporter after Playwright stops its server process tree. It requires the current run's marker, unlinks the dependency junction or symlink, and removes only the owned temporary folder. A missing or stale ownership marker leaves the folder untouched.

## Coverage

- Draft editing: unsaved-change warnings for app navigation, Back/Forward, fragment history, reload, and full document navigation; failed saves retain the warning, while successful saves clear it.
- Artifact removal: author/admin permissions, unlocked-draft boundaries, database-content deletion, audit records, physical backup cleanup, transaction rollback, and concurrent review transitions. A failed physical cleanup is logged; the removed artifact remains inaccessible through the application.
- Keyboard search: `/` focuses the visible library search, while typing, composition, modified shortcuts, and absent search fields retain their normal behavior.
- Learning resources: all 15 public topic pages keep the introduction-to-depth progression and optional exercises; search combines words, starting level, and stated tool platform. Browser checks cover bookmarks, restored reading sections and disclosures, shared browser-tab progress, blocked/corrupt storage, inline glossary controls, learning-path order, legacy fragment redirects, filtered practice links, sticky navigation, and layouts from 320 to 1440 pixels.
- Account learning: authentication, same-origin mutations, stale-account rejection, per-account rows and caches, concurrent field updates, offline retry, explicit guest import, and clearing visible account state after session expiry. A real integration test signs into two isolated browser contexts as one learner and a third as another learner, then verifies cross-device progress and isolation from other users and signed-out views.
- Local mailbox: configured loopback Host and Origin checks, cross-site rejection, and production/disabled-mail rejection.
- Production authentication: valid proxy-stamped client IPs, rejection of missing or malformed IP headers, shared login limits across native and wrapped endpoints, concurrent requests, spoofed forwarding headers, and equivalent IPv4/IPv6 addresses.
- Profile codenames: concurrent first claims stay locked to one name; competing players claiming one name receive a conflict while retries remain safe.
- Player integration: real registration, email verification, password reset, private download and SHA-256, participant staff denial, concurrent correct submissions awarding points once, and returning progress.
- Staff integration: real authenticator enrollment and verification, draft uploads and removal, reviewer and self-publication restrictions, independent review, and immutable review/published files.

CI also runs artifact-removal, competition/database-access, learning-progress isolation/concurrency, and profile-concurrency tests against a disposable PostgreSQL service. A local `TEST_DATABASE_URL` must point to a disposable test database.

The recovery drill requires PostgreSQL server/client tools and creates its own separate loopback cluster without loading local application credentials. See [the release rehearsal](RELEASE_REHEARSAL.md) for the command and shared staging handoff. Training fixture checks establish consistency, not independent human review or participant feedback.

## Evidence limits

These checks validate local behavior with synthetic accounts, artifacts, and flags. They do not complete [issue #3](https://github.com/Llenoxinn/dfCTF/issues/3): shared HTTPS staging, deployed PostgreSQL/storage persistence and restoration, real SMTP delivery, and enabled external OAuth callbacks still require their deployment configuration and observed results. Record the tested commit, URL, date, and result when those checks are performed.

## Latest local verification

On 29 October 2026, source revision `8bb573e70bce9518e72e06a22bea7f0a799663fb` passed TypeScript validation, all 142 unit tests, the production build, all 51 browser tests, and all three real integration tests. `npm audit --include=dev --audit-level=high` reported zero vulnerabilities. [GitHub Actions run 40723514583](https://github.com/Llenoxinn/dfCTF/actions/runs/40723514583) passed the same source revision, including the disposable PostgreSQL concurrency checks. These results do not validate live reverse-proxy behavior, SMTP, external OAuth, deployed storage persistence, or backup restoration; production authentication still requires the ingress configuration in [deployment and recovery](DEPLOYMENT.md).

The subsequent release-rehearsal changes passed TypeScript validation, all 142 unit tests, and the production build. A separate PostgreSQL 18.3 recovery run passed eleven check groups, and all three training fixtures passed their consistency checks. The [release rehearsal record](RELEASE_REHEARSAL.md) identifies the tested application revision, script checksum, local evidence, and shared staging work still awaiting configuration and participants.
