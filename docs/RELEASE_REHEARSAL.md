# First shared release rehearsal

The security changes in [PR #21](https://github.com/Llenoxinn/dfCTF/pull/21) were merged on 29 October 2026 as `888b8c96bf10f2c94aa0ca8a50a375c9ad5c4695`. Both existing checkouts were fast-forwarded to that revision before this rehearsal work began.

## Local recovery drill

Run the disposable PostgreSQL drill from the repository root. PostgreSQL server and client tools must be installed; this does not connect to an existing database or load `.env.local`.

```powershell
$env:DFCTF_POSTGRES_BIN = 'C:\Program Files\PostgreSQL\18\bin'
npm run test:recovery
```

On a system with PostgreSQL tools installed through its package manager:

```sh
DFCTF_POSTGRES_BIN="$(pg_config --bindir)" npm run test:recovery
```

The drill uses fictional accounts and evidence, a separate loopback PostgreSQL cluster, a custom-format dump, an artifact snapshot, and the original synthetic secrets. It restores into a different database and checks a new login, persisted progress, and an authenticated download. Evidence and synthetic secrets remain under ignored `.data/release-rehearsals/`; never upload that directory or use these credentials on a shared deployment. CI runs this drill separately from the existing PostgreSQL application tests.

On 29 October 2026 at 21:37 Philippine time, the drill passed against application revision `888b8c96bf10f2c94aa0ca8a50a375c9ad5c4695` using PostgreSQL 18.3. All eleven check groups passed, including the original session, fresh password sign-in, one saved solve and 50 XP, signed-out download denial, artifact checksums, restored legacy file-only downloads, database-only downloads, and zero XP for a repeat solve. The run also passed with deliberately conflicting inherited PostgreSQL environment settings. The owned cluster stopped afterward; the existing PostgreSQL service was left running.

The local sanitized report is `.data/release-rehearsals/restore-3RVJB4/report.json`. The 60,026-byte dump has SHA-256 `e3ed8f6fc67a730aef29bb5f9d1fbdf8b10d52ecb3b6d4bc698fb50fa7a34410`; the executed rehearsal script has SHA-256 `56a7340768459def581d58f7fae99119eb84324f100b6b7a5f51ba6af2938e31`. This exercises synthetic data through application route handlers. It does not establish recovery of a real deployment, its PostgreSQL version, or encrypted off-host backups.

## Shared staging run

The checked local configuration and GitHub repository contain no staging deployment, public domain, configured SMTP transport, or configured OAuth provider. These are required inputs, not completed checks. Keep [issue #3](https://github.com/Llenoxinn/dfCTF/issues/3) open until the observed staging results are recorded.

1. Configure separate HTTPS staging, PostgreSQL, SMTP, and distinct secrets using [the Vercel checklist](VERCEL.md) or [Docker deployment and recovery](DEPLOYMENT.md). Vercel uses database-only artifacts; Docker can retain private disk copies. Keep populated environment files ignored. Verify the ingress supplies the trusted `X-Real-IP`; a self-hosted app port must remain private.
2. Record the exact deployed revision and URL. Register a fictional player through the public origin, receive verification and password-reset mail through the actual SMTP provider, and test sign-in, sign-out, returning progress, and each enabled OAuth callback.
3. Use separate author and reviewer accounts with current-session MFA. Test participant denial, independent publication, suspension and restoration, simultaneous practice/event submissions, download checksums, restart persistence, and spoofed-forwarding-header throttling.
4. Take a real staging backup during a write pause, including PostgreSQL, artifact backups, and required secrets. Restore it into a separate environment using the matching app revision. Recheck login, saved points, and a protected download before upgrading.
5. Independently review and publish the selected [training fixtures](release-challenges/README.md) on staging. They have source-visible answers and must not be advertised as undisclosed ranked competition challenges. Follow the pack's tester protocol and record actual feedback; no participant feedback has been collected yet.

Use a result row for every deployment check:

| Check | Revision | HTTPS URL | Date | Observed result and evidence |
| --- | --- | --- | --- | --- |
| Real SMTP, enabled OAuth, proxy, permissions, persistence, restore, and pilot feedback | Pending | Not configured | Pending | Not yet observed on shared staging |

## Invitation draft

Send only after the staging checks pass and the intended testers are identified. Replace the placeholders before sending.

> I'm testing dfCTF at [staging URL] and would appreciate a short trial. Please create a test account, verify your email, choose a codename, and try the three training challenges. Sign out and return to check that your points remain. Follow the platform rules and avoid using any real credentials or sensitive files. Please tell me where you got stuck, any errors you saw, and how long each challenge took. These are training fixtures with known answers; this is a usability test, not a ranked event.
