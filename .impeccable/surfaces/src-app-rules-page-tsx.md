---
version: 1
slug: "src-app-rules-page-tsx"
primary_target: "src/app/rules/page.tsx"
related_targets: ["src/components/workspace.tsx","src/components/authoring.tsx"]
---

# Rules and challenge solvers

Scope: Read mode for /rules; Operate mode for the solver section and staff draft action. Extend the existing dfCTF design. The user requested solver identity, first blood, and a rules-based hidden-flag challenge, and supplied prohibitions on LLM-assisted solving, platform attacks or abuse, and plagiarism.

## Direction contract

THESIS: Clear instructions and verifiable solve attribution. Keep the rules as readable prose and the solvers as a chronological list.

OWN-WORLD: Inherit dfCTF's existing surfaces, type, inline SVG identicons, borders, and semantic accent colors. No replacement visual identity or imagery.

STORY: A player reads the rules, assembles three field notes into a flag, and returns to solve. Challenge visitors identify first blood and browse every solver without seeing private account details.

FIRST VIEWPORT: Rules use the existing header, a left contents list, and a readable article column. On phones the contents precede the article. Solvers sit below the challenge content, with first blood above the numbered list; the submission sidebar stays familiar.

FORM: Extend the established application with a contents-and-article reading view and chronological solver list. No concept roll for this constrained extension; seed: none (unavailable). The signature interaction is assembling field notes and seeing a newly saved solve appear in the attribution list. No new motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
