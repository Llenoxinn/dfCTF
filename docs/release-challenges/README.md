# First staging challenge pack

These three fictional onboarding fixtures reuse this repository's [`scripts/seed.ts`](../../scripts/seed.ts). They are preparation material for an isolated staging trial, not new original competition problems. Their flags already appear in the source. Do not use them for a ranked event or describe them as independently human-reviewed.

The pack was assembled with AI assistance. Automated fixture checks establish consistency; they do not replace an eligible person's independent test-solve. The existing no-LLM solving and attribution rules still apply to participants and reviewers.

## Files and settings

Only the matching `description.md` goes in the player-facing Description field. Upload only the artifact named below. Keep `staff-review.json`, this handoff, and `verify.mjs` with staff; do not attach them to challenges or give them to trial players.

| Title | Category | Artifact | Time | XP |
| --- | --- | --- | --- | --- |
| First contact | General skills | `player/first-contact/field-note.txt` | 5 min | 50 |
| The midnight request | Forensics | `player/midnight-request/access.log` | 15 min | 50 |
| Cookie crumbs | Web exploitation | `player/cookie-crumbs/response.txt` | 15 min | 50 |

All three are Easy, use `dfCTF{...}`, and need no paid software, executable files, live targets, or outside accounts. The small artifacts are plain text. Avoid duplicating titles if the staging instance already has these seed challenges.

Run the fixture check from the repository root:

```text
node docs/release-challenges/verify.mjs
```

It recovers each supplied answer, checks the staff key and player descriptions, and prints artifact SHA-256 values. This is a staff check; trial players solve independently without this script or the key.

## Author and reviewer handoff

1. Use the isolated staging instance with fictional accounts. Do not run the development seed against production. The maintainer grants separate author/admin and reviewer roles through the existing admin CLI; both complete their own current-session MFA.
2. The author creates drafts using the settings above and the corresponding metadata in `staff-review.json`. Paste the matching player description, put the flag only in Flag, and put the staff solution only in Walkthrough. Record the seed-source attribution in the staff handoff. Upload the single matching artifact.
3. Before publication, the reviewer receives only the player descriptions and artifacts and test-solves them using conventional tools. Record the real reviewer codename, elapsed time, method, ambiguities, and pass/fail result. Leave these fields pending until that person does the work.
4. Compare the reviewer's independently recovered answer with the staff key. Resolve unclear instructions by returning the challenge to draft. An eligible reviewer different from the author moves an accepted draft through Review and uses its test-solve flag to publish it on staging.
5. From a fresh participant account, confirm the walkthrough is hidden before a solve, each download works, a wrong answer awards no XP, a correct answer awards 50 XP once, and returning after sign-out preserves progress. An automated or staff test is not participant feedback.

Current status: fixtures prepared; independent human review, staging publication, and participant trial pending.

## Small participant trial

Ask two or three willing testers to register their own fictional staging accounts and attempt the challenges in the order above. Share the staging URL and platform rules, not the repository directory or staff key. Do not collect passwords, verification codes, session tokens, or submitted flags in feedback. The maintainer must choose the testers and contact channel; this pack does not send invitations.

Copy this blank record for each tester:

```text
Trial date and timezone:
Application commit and staging URL:
Tester codename (optional):
Browser and device:
Registration and verification email: pass / fail / not tried
Challenge title and elapsed minutes:
Was the scope and next step clear?
Could you download and inspect the artifact with your usual tools?
Did wrong/correct/repeated submissions behave as expected?
Did progress survive signing out and returning?
Where did you get stuck? Describe the step without including a flag.
One change that would help:
Issue link or redacted screenshot, if needed:
```

Replace source-visible fixtures with maintainer-authored, independently reviewed content before an actual competition. Keep trial feedback separate from claims that real SMTP, OAuth, backup recovery, or a shared deployment has been validated.
