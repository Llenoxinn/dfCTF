# Player Profile

The Profile tab is owner-only; it does not create public profile routes. Account
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

## Card and export

The card is a 1200 × 675 SVG with a responsive image preview. The same renderer
is rasterized locally to a 2400 × 1350 PNG. It uses an explicit background,
system sans/monospace fonts resolved by the same browser for both images, and
the platform's deterministic inline identicon. No remote avatars, image proxy,
third-party renderer, or new export dependency is needed. There is no avatar
upload service in the platform, so no nonfunctional upload control is added.

The server constructs an explicit public-data card projection. Only the
codename, optional chosen profile text, selected practice scope, official rank,
points, capture/First Blood counts, proven milestones, and snapshot time can
enter the renderer. Email, auth IDs, tokens, submissions, flags, private challenge
metadata, and audit records are excluded. XML is escaped and text is bounded.

Three card themes, three curated accents, optional fields, and up to two proven
milestones can be selected. Preferences are saved only in this browser under an
account-specific key; storage failures are disclosed. Factual values are never
editable. The export module is loaded on demand, freezes the selected SVG for a
single export, bounds font/image waits, prevents concurrent requests, and frees
temporary object URLs. Profile edits remain owner-only until the user shares a
downloaded card; they do not publish a profile page.
