# Player Profile

The Profile page in the account menu is owner-only. The signed-in [Socials section](SOCIALS.md) lets
players view each other's codenames and practice results, with optional profile
details shared only after the owner opts in. Account
security and immutable codenames remain in the existing Settings/onboarding
flows. Optional display name, bio, website, and GitHub link live in a minimal
`player_profiles` table, protected by the same session/access checks and RLS as
other application tables. Apply its committed migration before deployment.

## Authoritative data

- Scope is **Practice / all time** or **Practice / this week** (Asia/Manila).
  Competitions retain their separate event scoreboards; their points are never
  summed into practice. Teams and official achievements are not implemented.
- Valid, distinct `solves` records define captures. Submission attempts never
  increment them. The `xp_ledger` defines historical awarded XP, including zero
  awards for another solve in an already rewarded family. Current challenge XP
  is not substituted for an award. There is no dynamic scoring, solve revocation,
  score-adjustment interface, or frozen practice board in this release.
- Rank follows the official practice board: awarded points descending, time the
  score was reached ascending (millisecond precision), then binary codename
  order. A player without qualifying solves is unranked, not rank zero.
- First Blood is the first stored solve for a challenge ordered by timestamp,
  then solve ID. The winner is determined before applying the selected scope.
- Headline totals retain historical solves as the official board does. Category
  completion and paginated activity expose only currently published practice
  challenges. Category membership uses the current published version; points are
  the actual historical awards. The UI explains this distinction.
- Milestones are derived facts within the selected scope, not official awards:
  one capture, ten captures, and at least one verified First Blood. No invented
  rarity or earned dates. Scope changes refresh every dependent panel and card.

Dashboard reads use a repeatable-read snapshot, server-side aggregates, and
bounded keyset activity pages. No full attempt history or private auth fields
are sent to the dashboard. Only the authenticated owner can edit; the PATCH
schema rejects identity, role, score, and unknown fields.

## Page layout

The owner page leads with one hero: a dithered band generated from the codename
(`codenameField` in `src/lib/pixel.ts`, nothing stored), then identity, with rank
and points as the largest content. Below it, the category map shows one square per
currently published challenge, milestones show earned and not-yet states as goals,
and recent solves form a dense list. A player with no solves gets one step to the
challenges. The interface says "points" and "solves", as the leaderboard does; the
Socials player view has its own layout and still says "XP" and "captures".

## Card and export

The card opens on demand from Share card, in a dialog that cannot close during an
export. The card is a 1200 × 675 SVG with a responsive image preview. The same renderer
is rasterized locally to a 2400 × 1350 PNG. It uses an explicit background,
one consistent system monospace family resolved by the same browser for both images, and
the platform's deterministic inline identicon. No remote avatars, image proxy,
third-party renderer, or new export dependency is needed. There is no avatar
upload service in the platform, so no nonfunctional upload control is added.

The server constructs an explicit public-data card projection. Only the
codename, optional chosen profile text, selected practice scope, official rank,
points, capture/First Blood counts, proven milestones, and snapshot time can
enter the renderer. Email, auth IDs, tokens, submissions, flags, private challenge
metadata, and audit records are excluded. XML is escaped and text is bounded.

Dark and Light card themes, three curated accents, optional fields, and up to two proven
milestones can be selected. Preferences are saved only in this browser under an
account-specific key; storage failures are disclosed. Factual values are never
editable. The export module is loaded on demand, freezes the selected SVG for a
single export, bounds font/image waits, prevents concurrent requests, and frees
temporary object URLs. Optional profile details remain owner-only unless the
owner enables sharing with signed-in players or shares a downloaded card.

## Verification and rollout

Verification uses explicitly synthetic players, challenges, and scores. Browser
coverage includes owner editing and validation, keyboard focus restoration,
scope changes, account-isolated preferences, reset, expired sessions, failed
image decoding and retry, overlapping clicks, and changes during an export.
Downloaded PNG signatures and 2400 × 1350 dimensions are asserted at device
pixel ratio 2, including a narrow viewport. Actual populated, empty, and long
Unicode PNGs were opened and visually inspected across the three themes.

The current verification passed TypeScript, 180 unit tests in 19 files, 82 browser
tests, and five real local integration flows. The Profile integration flow
persists edits, submits a valid fixture solve, compares the owner's statistics
with the official board, and checks sign-out and second-account isolation.

The production build also checks its server-file manifests to exclude local
databases, credentials, and private development files. There is no standalone
lint script in this repository; TypeScript, the existing test suites, and the
production build are the configured checks.

Before deploying, apply `0005_player_profiles` using the existing migration
connection and verify the new table, RLS, and two solve indexes. The migration
is additive and existing profile rows are optional. Local verification does not
apply migrations to a shared database.

On 3 November 2026, after explicit owner approval, a consistent logical row
snapshot of the existing staging application tables and migration journal was
saved under the ignored `.data/profile-upgrade-backups/` directory together with
the pre-upgrade SQL migrations. This is a private local snapshot, not a pg_dump
archive or a completed restore drill. Migration `0005_player_profiles` was then
applied to the saved staging database; the new table's RLS and both solve
indexes were verified before publishing the application changes.
