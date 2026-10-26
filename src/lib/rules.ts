export const RULES_CHALLENGE_TITLE = "Read the fine print";
export const RULE_FIELD_NOTES = ["dfCTF{read_", "the_rules_", "before_you_play}"] as const;

export const RULE_SECTIONS = [
  {
    id: "independent-play", title: "Solve independently",
    paragraphs: [
      "dfCTF is an individual competition. Work through each challenge yourself. Do not share flags, trade answers, submit someone else’s work, or use extra accounts to gain an advantage.",
      "Discuss general techniques without revealing a challenge’s answer. Keep challenge-specific walkthroughs and solution code private while the challenge is available for play.",
    ],
    note: RULE_FIELD_NOTES[0],
  },
  {
    id: "no-llms", title: "No LLM-assisted solving",
    paragraphs: [
      "Do not use large language models or AI assistants to solve challenges. This includes asking a chatbot or coding assistant to analyze artifacts, interpret evidence, generate solution code, explain a challenge-specific error, or recover or guess a flag.",
      "Submit work you understand and completed yourself. Documentation, textbooks, search engines, and conventional tools such as a terminal, debugger, hex editor, or Wireshark are allowed; AI-generated answers and AI summaries used to solve a challenge are not.",
    ],
  },
  {
    id: "allowed-tools", title: "References, tools, and clarification",
    paragraphs: [
      "You may consult search engines, official documentation, public tutorials, textbooks, and other reference material to learn a technique. Use those resources to support your own work; copying a challenge’s published answer or using an AI-generated solution is not allowed.",
      "You may use tools installed on your own machine, unless the challenge sets a narrower tool policy. Follow the scope in the description and keep your investigation within the supplied material.",
      "Ask the organizers when an instruction is unclear or something appears broken. Request clarification about the task, not a flag, a solution, or confirmation of a guessed answer.",
    ],
  },
  {
    id: "scope", title: "Respect the scope",
    paragraphs: [
      "Work only with the fictional material supplied by the challenge. Downloadable files are for local investigation. A challenge title or category is never permission to attack a real person, account, website, or service.",
      "Do not attack dfCTF, its hosting, its authentication, or other players. Scanning infrastructure, denial of service, credential attacks, automated flag guessing, bypassing rate limits, and exploiting platform bugs to access private data or change scores are prohibited.",
      "If you discover a vulnerability in this website, stop and report it privately to the developers. Include the affected page and the minimum evidence needed to explain the issue. Never use a platform flaw to gain points, alter standings, access another account, or retrieve private data; do not exploit it further or publish sensitive details.",
    ],
    note: RULE_FIELD_NOTES[1],
  },
  {
    id: "original-work", title: "Original challenges and proper credit",
    paragraphs: [
      "Authors must submit their own challenges and walkthroughs. Do not copy another creator’s problem, files, flag, or solution and present it as original work. Renaming or lightly rewriting a copied problem does not make it original.",
      "Use third-party material only when you have permission or its license allows it. Credit the source and describe any adaptation for the reviewer. A different eligible reviewer must test-solve the challenge before publication.",
    ],
  },
  {
    id: "scoring", title: "Flags, points, and first blood",
    paragraphs: [
      "Register, verify your email, and choose a public codename before submitting. Submit the complete dfCTF{...} flag. Surrounding whitespace is ignored, the wrapper is case-insensitive, and the answer inside the braces is case-sensitive.",
      "Your first eligible solve awards the listed points once per challenge family. Wrong answers do not deduct points. Repeated guesses trigger a cooldown. A solve unlocks the walkthrough and appears in your saved progress.",
      "The challenge card shows the points available before you attempt it. Use the relevant scoreboard as the authoritative record of standings. Built-in competition points are recorded on that event’s scoreboard, separately from practice XP.",
      "The current dfCTF workspace does not offer paid hints. For a CTFd-hosted event, read its hint policy and any displayed point cost before unlocking a hint; that event’s own rules and scoreboard apply.",
      "The earliest recorded solve is first blood. It earns recognition, with no extra points. Each challenge lists its solvers by public codename and completion time; account emails and provider names stay private.",
    ],
  },
  {
    id: "weekly", title: "Weekly standings and fair play",
    paragraphs: [
      "Weekly standings run from Monday 00:00 through Sunday 23:59:59.999 in Asia/Manila (UTC+8). All-time standings retain your eligible points. Ties go to the player who reached the score first.",
      "A weekly featured challenge stays in the library after its publication week. Solving it later counts toward the week in which you solve it; an old weekly label does not renew its original deadline.",
      "Treat other players and creators with respect. Report suspected cheating or copied challenges privately to the maintainers, with evidence. Rule violations may lead to account suspension.",
    ],
    note: RULE_FIELD_NOTES[2],
  },
] as const;
