import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Content } from "../src/components/content";
import { formatText, linkText } from "../src/lib/formatting";
import { summarize } from "../src/server/validation";

function render(text: string) { return renderToStaticMarkup(createElement(Content, { text })); }

describe("challenge description formatting", () => {
  it.each([
    ["bold", "**evidence**", "<strong>evidence</strong>"],
    ["italic", "*evidence*", "<em>evidence</em>"],
    ["underline", "<u>evidence</u>", "<u>evidence</u>"],
    ["strike", "~~evidence~~", "<del>evidence</del>"],
    ["code", "`evidence`", "<code>evidence</code>"],
  ] as const)("formats selected words with %s and can remove that style", (kind, markup, html) => {
    const value = "Inspect evidence carefully.";
    const edit = formatText(value, 8, 16, kind);
    expect(edit.value).toBe("Inspect " + markup + " carefully.");
    expect(edit.value.slice(edit.start, edit.end)).toBe("evidence");
    expect(render(edit.value)).toContain(html);
    expect(formatText(edit.value, edit.start, edit.end, kind).value).toBe(value);
  });

  it("keeps surrounding spaces outside inline marks and selects a placeholder at the caret", () => {
    expect(formatText("Inspect the file ", 7, 17, "bold").value).toBe("Inspect **the file** ");
    const edit = formatText("", 0, 0, "italic");
    expect(edit.value).toBe("*text*");
    expect(edit.value.slice(edit.start, edit.end)).toBe("text");
  });

  it.each([
    ["bullet", "- first\n- second", "<ul>"],
    ["number", "1. first\n2. second", "<ol>"],
    ["quote", "> first\n> second", "<blockquote>"],
    ["heading", "## first\n## second", "<h3>first</h3>"],
  ] as const)("applies and removes %s on complete selected lines", (kind, markup, tag) => {
    const value = "Before\nfirst\nsecond\nAfter";
    const edit = formatText(value, 9, 19, kind);
    expect(edit.value).toBe("Before\n" + markup + "\nAfter");
    expect(render(edit.value)).toContain(tag);
    expect(formatText(edit.value, edit.start, edit.end, kind).value).toBe(value);
  });

  it("keeps the line after a selection ending at a newline unchanged", () => {
    expect(formatText("first\nsecond", 0, 6, "bullet").value).toBe("- first\nsecond");
  });

  it.each([["bullet", "- "], ["number", "1. "], ["heading", "## "], ["quote", "> "]] as const)("starts %s in an empty description", (format, markup) => {
    const edit = formatText("", 0, 0, format);
    expect(edit.value).toBe(markup);
    expect(edit.start).toBe(markup.length);
    expect(edit.end).toBe(markup.length);
  });

  it("combines bold and italic on the same selection and toggles each independently", () => {
    const bold = formatText("evidence", 0, 8, "bold");
    const both = formatText(bold.value, bold.start, bold.end, "italic");
    expect(render(both.value)).toContain("<em><strong>evidence</strong></em>");
    expect(formatText(both.value, both.start, both.end, "italic").value).toBe("**evidence**");
    expect(formatText(both.value, both.start, both.end, "bold").value).toBe("*evidence*");
  });

  it("preserves literal backticks inside inline code and fenced blocks", () => {
    const inline = formatText("a`b", 0, 3, "code");
    expect(render(inline.value)).toContain("<code>a`b</code>");
    expect(formatText(inline.value, inline.start, inline.end, "code").value).toBe("a`b");
    const code = "```text\nliteral\n```";
    const block = formatText(code, 0, code.length, "codeblock");
    expect(render(block.value)).toContain("<pre><code>```text\nliteral\n```\n</code></pre>");
  });

  it("places code blocks on their own lines and preserves blank lines and literal markup", () => {
    const code = "echo **literal**\n\ncat <evidence>";
    const edit = formatText("Start " + code + " end", 6, 6 + code.length, "codeblock");
    expect(edit.value.slice(edit.start, edit.end)).toBe(code);
    const html = render(edit.value);
    expect(html).toContain("<pre><code>echo **literal**\n\ncat &lt;evidence&gt;");
    expect(html).not.toContain("<strong>");
  });

  it("renders nested styles, lists, links, headings and old descriptions with one renderer", () => {
    const html = render("## Objective\n\n**Inspect *this* <u>file</u>**.\n\n- First\n- Second\n\n[Reference](https://example.com)\n\nUse `strings`.");
    for (const tag of ["<h3>Objective</h3>", "<strong>", "<em>this</em>", "<u>file</u>", "<li>First</li>", "<code>strings</code>", 'href="https://example.com"', 'rel="noopener noreferrer"']) expect(html).toContain(tag);
  });

  it("rejects executable links and strips active HTML, remote images, and styling", () => {
    const html = render('<script>alert(1)</script>\n\n<u onclick="alert(2)" style="color:red">Safe</u> <img src="https://tracker.test/pixel" onerror="alert(3)">\n\n[Bad](javascript:alert) <a href="javascript:alert(4)">Unsafe</a><iframe src="https://bad.test"></iframe><input autofocus>');
    expect(html).toContain("<u>Safe</u>");
    expect(html).not.toMatch(/<script|onclick|onerror|style=|<img|<iframe|<input|javascript:/);
    expect(html).toContain("Unsafe");
  });

  it("inserts safe links with readable labels and escaped destinations", () => {
    const edit = linkText("Read this guide today.", 5, 15, "https://example.com/a(b)");
    expect(edit.value).toBe("Read [this guide](https://example.com/a%28b%29) today.");
    expect(render(edit.value)).toContain('href="https://example.com/a%28b%29"');
    expect(() => linkText("", 0, 0, "javascript:alert(1)")).toThrow();
    expect(() => linkText("", 0, 0, "not a url")).toThrow();
  });

  it("derives a plain summary without formatting marks, HTML, or link destinations", () => {
    expect(summarize("## Objective\n\n**Inspect** the <u>training file</u> with [this guide](https://example.com/a.b). Then use `strings`.")).toBe("Inspect the training file with this guide.");
    expect(summarize("~~Old~~ *New* objective.")).toBe("Old New objective.");
    expect(summarize("- **Inspect** the file.\n- Recover its flag.")).toBe("Inspect the file.");
  });
});
