---
version: 1
slug: "src-components-competitions-tsx"
primary_target: "src/components/competitions.tsx"
related_targets: ["src/components/authoring.tsx","src/components/workspace.tsx"]
---

# Competition hosting

Scope: Operate mode, extending dfCTF. The user selected built-in individual competitions plus links to CTFd hosts. Admins configure titles, schedules in Philippine time, notes, reviewed private challenges, and fixed points. Players register, solve inside the event, and compare its separate scoreboard.

## Direction contract

THESIS: A familiar event directory and explicit host form, with competition identity and boundaries clear before joining.

OWN-WORLD: Reuse the existing typography, panel borders, compact controls, challenge cards, dark/light tokens, and semantic accent color. No new identity or artwork.

STORY: Hosts select built-in dfCTF or an HTTPS CTFd link, save a draft, then publish a fixed configuration. Players see the schedule, join native events, and access challenges at the start.

FIRST VIEWPORT: The title and Manage events action lead a dated event list. Event detail places hosting mode, schedule, registration, and rules above challenge cards and the scoreboard. Mobile stacks the same controls without horizontal page overflow.

FORM: Extend the established app using list, detail, and settings views. The signature interaction is switching hosting mode and preserving the distinction between native event points and practice XP. Inherit existing button feedback; no new motion. seed: none (unavailable).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
