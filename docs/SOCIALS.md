# Player discovery and friendships

Socials is a signed-in workspace section. Leaderboard names link to
`/?view=socials&player=CODENAME`; links preserve native new-tab behavior and the
destination survives sign-in, reload, and browser history. Directory and
connection lists use bounded 20-player pages with filter-bound keyset cursors.
Only verified accounts with a codename and current platform access are listed.

Player views reuse the authoritative Profile practice aggregates and scope
rules. They expose rank, historical awarded XP, capture/First Blood totals,
current published-category progress, proven milestones, and up to 12 visible
captures. No submission contents, concealed challenge titles, event results,
authentication identifiers, email, provider images, or account-security fields
are serialized. Codenames and practice results were already public platform
data; the new views require signed-in platform access.

Existing optional profile details stay private. The additive
`0006_social_connections` migration adds `share_profile=false` to owner details.
Owners can explicitly share their display name, bio, website, and GitHub link
with signed-in players in Edit profile. Opting out hides those fields again in
both directory results and player views. Friendship does not change this rule.
Exporting a card remains an independent owner action.

One RLS-enabled `friendships` row represents an unordered pair of accounts.
The primary key and pair/requester/status checks prevent duplicates and invalid
pairs. Requests remain pending until the other account explicitly accepts;
simultaneous cross-requests never auto-accept. Only the recipient can accept or
decline, only the sender can cancel, and either friend can remove a connection.
Each API derives the acting account from its authenticated session; it never
accepts a viewer ID or a client-supplied friendship status. Existing same-origin
JSON protections apply to every mutation.

Friends, incoming requests, and outgoing requests are visible only to the
authenticated owner. Requests are limited to 20 per day per sender; other
connection actions use the existing minute-based limiter. Declined requests
have a seven-day per-pair cooldown. No email, push notification, messaging,
presence tracking, or public friend graph is introduced.

The migration also adds indexes for the second endpoint of a friend pair and
the directory's case-insensitive codename ordering. Apply the reviewed migration
before deploying the new APIs/UI. Card customization now has only Dark and Light
themes, with one consistent sans-serif font family in both preview and PNG;
old Carbon/Midnight preferences map to Dark and Paper maps to Light.

## Verification

On 3 November 2026 the final implementation passed TypeScript, all 180 unit
tests in 19 files, all 82 browser regressions, five isolated local integration
flows, and the production build. All 46 server-file manifests passed the
private-file exclusion check. Fixtures are synthetic and no real player
requests were sent during verification.

The two-account integration flow verifies leaderboard-to-profile navigation,
explicit sharing and subsequent opt-out, friend requests, recipient acceptance,
mutual visibility, and removal. Unit coverage also checks cross-request
deduplication, third-party/sender acceptance denial, declined-request cooldowns,
request limits, private fields, inaccessible challenges, account suspension,
keyset pagination, strict mutation schemas, and same-origin authentication.
Browser checks cover network failure/retry, expired sessions, history, search,
competition-profile links, and narrow layouts in both site themes. Real Dark
and Light PNG downloads were checked for PNG format and 2400 × 1350 dimensions,
then opened for visual inspection.

## Staging upgrade

On 3 November 2026, after the owner's explicit approval for this migration, a
fresh consistent logical snapshot was saved under the ignored
`.data/socials-upgrade-backups/` directory, including pre-upgrade migrations and
the migration journal. This private row snapshot is not a pg_dump archive or a
completed restore rehearsal. A preflight check verified staging's previous
migration hash before applying `0006_social_connections`.

The migration succeeded. Friendship-table RLS, both new query indexes, and the
non-null, default-false sharing column were verified before publishing Socials.
No real player relationships were created during rollout. Production-domain
promotion remains a Vercel deployment step; a successful build alone does not
verify that the public domain serves the new revision.
