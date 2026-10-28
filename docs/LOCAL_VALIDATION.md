# Local validation

Run these checks from the repository root:

```text
npm run check
npm run test:browser
npm run test:integration
```

`check` runs TypeScript validation, unit tests, and the production build. Browser regressions run against that build on `127.0.0.1:3100`, with mocked API responses. Windows uses installed Microsoft Edge; other platforms use Playwright Chromium.

The integration suite starts the real application on `127.0.0.1:3200`. It copies application sources and build configuration into a separate temporary folder and links the installed dependencies. It does not copy `.env.local`, the developer database, artifacts, mailbox, or local credentials. Each run uses a separate PGlite database, private artifact files, local email, and randomly generated auth and flag secrets.

The helper refuses a populated temporary folder and writes a unique ownership marker before creating fixtures. Cleanup runs in the test reporter after Playwright stops its server process tree. It requires the current run's marker, unlinks the dependency junction or symlink, and removes only the owned temporary folder. A missing or stale ownership marker leaves the folder untouched.

## Coverage

- Draft editing: unsaved-change warnings for app navigation, Back/Forward, fragment history, reload, and full document navigation; failed saves retain the warning, while successful saves clear it.
- Artifact removal: author/admin permissions, unlocked-draft boundaries, database-content deletion, audit records, physical backup cleanup, transaction rollback, and concurrent review transitions. A failed physical cleanup is logged; the removed artifact remains inaccessible through the application.
- Keyboard search: `/` focuses the visible library search, while typing, composition, modified shortcuts, and absent search fields retain their normal behavior.
- Learning resources: all 15 public topic pages keep the introduction-to-depth progression and optional exercises; search combines words, starting level, and stated tool platform. Browser checks cover bookmarks, restored reading sections and disclosures, shared browser-tab progress, blocked/corrupt storage, inline glossary controls, learning-path order, legacy fragment redirects, filtered practice links, sticky navigation, and layouts from 320 to 1440 pixels.
- Local mailbox: configured loopback Host and Origin checks, cross-site rejection, and production/disabled-mail rejection.
- Player integration: real registration, email verification, password reset, private download and SHA-256, participant staff denial, concurrent correct submissions awarding points once, and returning progress.
- Staff integration: real authenticator enrollment and verification, draft uploads and removal, reviewer and self-publication restrictions, independent review, and immutable review/published files.

CI also runs artifact-removal and competition/database-access tests against a disposable PostgreSQL service. A local `TEST_DATABASE_URL` must point to a disposable test database.

## Evidence limits

These checks validate local behavior with synthetic accounts, artifacts, and flags. They do not complete [issue #3](https://github.com/Llenoxinn/dfCTF/issues/3): shared HTTPS staging, deployed PostgreSQL/storage persistence and restoration, real SMTP delivery, and enabled external OAuth callbacks still require their deployment configuration and observed results. Record the tested commit, URL, date, and result when those checks are performed.

## Latest local verification

On 28 October 2026, the learning-library working tree based on `22347d4` passed TypeScript validation, all 99 unit tests, the production build, all 48 browser tests, and both real integration tests. Cleanup regressions verified that missing or stale ownership markers preserve existing files and that deleting an owned fixture preserves linked dependencies. These local results do not claim GitHub CI success, live SMTP, external OAuth, deployed PostgreSQL, or backup-restore validation.
