# Contributing to dfCTF

Clear, focused issues help maintainers reproduce problems and evaluate improvements.
Search open and closed issues first. If a matching issue exists, add useful details
there instead of opening a duplicate. Keep each new issue focused on one problem or proposal.

## Choose an issue template

| Template | Use it for |
| --- | --- |
| [Bug report](ISSUE_TEMPLATE/bug_report.md) | Broken functionality, errors, incorrect results, or unexpected behavior. |
| [Feature request](ISSUE_TEMPLATE/feature_request.md) | A new capability, a workflow improvement, or a proposed redesign. |
| [Visual UI bug](ISSUE_TEMPLATE/visual_ui_bug.md) | Layout, styling, readability, contrast, or responsive display problems. |

For example, a failed score submission belongs in **Bug report**, a request for a
new leaderboard filter belongs in **Feature request**, and a leaderboard clipped
on a phone belongs in **Visual UI bug**.

## Submit an issue

1. Open the repository on GitHub and select **Issues**, then **New issue**.
2. Choose the template that best matches your report.
3. Keep the title prefix and add a specific summary, such as
   `[UI] Leaderboard columns overlap at a 390px viewport`.
4. Replace `...` and the other prompts with your answers, complete **Before submitting**, and keep the
   section headings. Write `Unknown` or `Not applicable` when needed; optional
   sections may be removed.
5. Add reproduction steps for bugs, observable acceptance criteria for features,
   and screenshots or a detailed visual description for UI problems.
6. Preview the issue, remove any sensitive information, and submit it. Respond to
   follow-up questions in the issue so the investigation stays in one place.

## Fill answers and check boxes

While creating or editing an issue, use the **Write** tab to change the Markdown
and **Preview** to check its appearance. Check a box by replacing the space inside
`[ ]` with `x`:

```markdown
- [ ] Not checked yet
- [x] Checked
```

For groups marked **select one**, check one matching option. For **select all that
apply**, check every matching option. Only confirm statements you have actually
completed. Feature **Acceptance criteria** describe future work and should remain
unchecked when the request is submitted.

Fill labeled answers directly after the label. In a table, replace the answer
between the `|` separators; keep the header and separator row intact:

```markdown
**What is broken?** Submitting a practice flag shows an unexpected error.

| Field | Your answer |
| --- | --- |
| Browser and version | Firefox 144 |
```

Keep the triple backticks around logs to preserve line breaks. Drag or paste images
into the issue editor to attach them. Text inside `<!-- ... -->` is an editing hint
and is hidden in Preview and the submitted issue.

To update an issue you already submitted, open its description's **...** menu,
select **Edit**, change the text or checkbox markers, and save. If you can edit the
issue, you can also toggle its rendered task-list checkboxes directly.

To change the reusable template for everyone, edit the relevant file in
`.github/ISSUE_TEMPLATE/` on the repository's **Code** tab using the pencil/edit
control, or in your local editor. Commit the change to `finalization`, then merge
it into the default branch. This affects future issues; existing issue bodies
must be edited separately.

Use fictional data in examples. Do not post passwords, tokens, session cookies,
personal information, CTF flags, challenge solutions, or private challenge files.
For a suspected exploitable security vulnerability, use GitHub's **Security →
Report a vulnerability** option if enabled, or contact a maintainer privately.

## Activate and maintain the templates

1. Keep the three template files in `.github/ISSUE_TEMPLATE/` with their `.md`
   extensions and YAML front matter (`name`, `about`, `title`, `labels`, `assignees`).
2. Merge the template changes from `finalization` into the repository's default
   branch (`main` in `Llenoxinn/dfCTF`). Pushing only to `finalization` does not
   activate the templates in GitHub's issue chooser.
3. In the repository's **Settings → General → Features**, make sure **Issues** is enabled.
4. Open **Issues → New issue** and confirm all three choices appear. Open each
   choice to check the title prefix and body; no test issue needs to be submitted.

Labels and assignees intentionally start empty. Maintainers can populate these
front-matter values later using labels and GitHub usernames available in the repository.
Keep this guide outside `ISSUE_TEMPLATE` so it is not offered as another issue template.

Markdown templates prefill an editable issue body; they guide contributors but
cannot require answers or checked boxes. If required fields become necessary,
use GitHub's YAML issue forms instead.

See GitHub's documentation on [configuring issue templates](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository)
and [issue templates and forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/about-issue-and-pull-request-templates).
For checkbox syntax, see [GitHub's task list documentation](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/about-tasklists).
