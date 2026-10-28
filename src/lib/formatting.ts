export type TextSelection = { value: string; start: number; end: number };
export type Format = "bold" | "italic" | "underline" | "strike" | "heading" | "bullet" | "number" | "quote" | "code" | "codeblock";

function replace(value: string, start: number, end: number, insert: string, offset = 0, length = insert.length): TextSelection {
  return { value: value.slice(0, start) + insert + value.slice(end), start: start + offset, end: start + offset + length };
}

/** Return an edit and its selection; the editor keeps focus on the formatted words. */
export function formatText(value: string, start: number, end: number, format: Format): TextSelection {
  if (["heading", "bullet", "number", "quote"].includes(format)) {
    const lineStart = start === 0 ? 0 : value.lastIndexOf("\n", start - 1) + 1;
    const nextBreak = value.indexOf("\n", Math.max(start, end - 1));
    const lineEnd = nextBreak < 0 ? value.length : nextBreak;
    const lines = value.slice(lineStart, lineEnd).split("\n");
    const marker = format === "heading" ? /^#{1,6} / : format === "quote" ? /^> / : format === "number" ? /^\d+\. / : /^[-+*] /;
    const remove = lines.some(line => marker.test(line)) && lines.every(line => !line.trim() || marker.test(line));
    const insert = lines.map((line, i) => {
      if (remove) return line.replace(marker, "");
      const plain = line.replace(/^(?:#{1,6} |[-+*] |\d+\. |> )/, "");
      const prefix = format === "heading" ? "## " : format === "quote" ? "> " : format === "number" ? String(i + 1) + ". " : "- ";
      return prefix + plain;
    }).join("\n");
    const caret = Math.max(0, start - lineStart + insert.length - (lineEnd - lineStart));
    return start === end ? replace(value, lineStart, lineEnd, insert, caret, 0) : replace(value, lineStart, lineEnd, insert);
  }
  if (format === "codeblock") {
    const selected = value.slice(start, end) || "command";
    const fence = "`".repeat(Math.max(3, ...(selected.match(/`+/g) ?? []).map(run => run.length + 1)));
    const leading = start && !value.slice(0, start).endsWith("\n\n") ? (value[start - 1] === "\n" ? "\n" : "\n\n") : "";
    const trailing = end < value.length && !value.slice(end).startsWith("\n\n") ? (value[end] === "\n" ? "\n" : "\n\n") : "";
    return replace(value, start, end, leading + fence + "\n" + selected + "\n" + fence + trailing, leading.length + fence.length + 1, selected.length);
  }
  const selected = value.slice(start, end);
  const ticks = "`".repeat(Math.max(1, ...(selected.match(/`+/g) ?? []).map(run => run.length + 1)));
  const [open, close] = format === "bold" ? ["**", "**"] : format === "italic" ? ["*", "*"] : format === "underline" ? ["<u>", "</u>"] : format === "strike" ? ["~~", "~~"] : [ticks, ticks];
  const hasItalicInside = format !== "italic" || ((selected.match(/^\*+/)?.[0].length ?? 0) % 2 === 1 && (selected.match(/\*+$/)?.[0].length ?? 0) % 2 === 1);
  if (hasItalicInside && selected.startsWith(open) && selected.endsWith(close) && selected.length >= open.length + close.length) {
    return replace(value, start, end, selected.slice(open.length, -close.length));
  }
  const hasItalicOutside = format !== "italic" || ((value.slice(0, start).match(/\*+$/)?.[0].length ?? 0) % 2 === 1 && (value.slice(end).match(/^\*+/)?.[0].length ?? 0) % 2 === 1);
  if (hasItalicOutside && start >= open.length && value.slice(start - open.length, start) === open && value.slice(end, end + close.length) === close) {
    return replace(value, start - open.length, end + close.length, selected);
  }
  const words = selected.trim() || "text";
  const left = selected.match(/^\s*/)?.[0] ?? "";
  const right = selected.trim() ? selected.match(/\s*$/)?.[0] ?? "" : "";
  return replace(value, start, end, left + open + words + close + right, left.length + open.length, words.length);
}

export function linkText(value: string, start: number, end: number, url: string): TextSelection {
  const parsed = new URL(url);
  if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("Use a link starting with https:// or http://.");
  const words = value.slice(start, end) || "link text";
  const label = words.replace(/([\\[\]])/g, "\\$1");
  const href = parsed.href.replace(/\(/g, "%28").replace(/\)/g, "%29");
  return replace(value, start, end, "[" + label + "](" + href + ")", 1, label.length);
}
