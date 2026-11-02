"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { formatText, linkText, type Format, type TextSelection } from "@/lib/formatting";
import { Content } from "./content";
import { Icon } from "./ui";

const tools: { format: Format; label: string; glyph?: string; icon?: string; shortcut?: string }[] = [
  { format: "bold", label: "Bold", glyph: "B", shortcut: "B" },
  { format: "italic", label: "Italic", glyph: "I", shortcut: "I" },
  { format: "underline", label: "Underline", glyph: "U", shortcut: "U" },
  { format: "strike", label: "Strikethrough", glyph: "S" },
  { format: "heading", label: "Heading", icon: "heading" },
  { format: "bullet", label: "Bulleted list", icon: "list-bullet" },
  { format: "number", label: "Numbered list", icon: "list-number" },
  { format: "quote", label: "Quote", icon: "quote" },
  { format: "code", label: "Inline code", icon: "code" },
  { format: "codeblock", label: "Code block", icon: "terminal" },
];
const toolGroups = [tools.slice(0, 4), tools.slice(4, 8), tools.slice(8)];
const limit = 20000;

export default function DescriptionEditor({ value, onChange, readOnly, inputId, validationError, focusRequest = 0 }: { value: string; onChange: (value: string) => void; readOnly: boolean; inputId?: string; validationError?: string; focusRequest?: number }) {
  const generatedId = useId(), id = inputId ?? generatedId, input = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  const [link, setLink] = useState<{ start: number; end: number } | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const locked = readOnly || preview;
  const pendingSelection = useRef<TextSelection | null>(null);

  useEffect(() => { if (validationError) setPreview(false); }, [validationError]);
  useEffect(() => {
    if (!focusRequest) return;
    setPreview(false);
    const frame = requestAnimationFrame(() => { input.current?.focus(); input.current?.scrollIntoView({ block: "center", behavior: "smooth" }); });
    return () => cancelAnimationFrame(frame);
  }, [focusRequest]);

  useLayoutEffect(() => {
    const edit = pendingSelection.current;
    pendingSelection.current = null;
    if (!edit || edit.value !== value) return;
    // Restore before the next interaction; a delayed frame can overwrite a newer selection.
    input.current?.focus();
    input.current?.setSelectionRange(edit.start, edit.end);
  }, [value]);

  function apply(edit: TextSelection) {
    if (readOnly) return;
    if (edit.value.length > limit) { setError("The description can contain up to 20,000 characters."); return; }
    pendingSelection.current = edit;
    onChange(edit.value); setError(""); setLink(null);
  }
  function format(kind: Format) {
    if (locked || !input.current) return;
    apply(formatText(value, input.current.selectionStart, input.current.selectionEnd, kind));
  }
  function shortcut(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((!event.ctrlKey && !event.metaKey) || event.altKey || event.shiftKey || locked) return;
    const kind = ({ b: "bold", i: "italic", u: "underline" } as const)[event.key.toLowerCase() as "b" | "i" | "u"];
    if (kind) { event.preventDefault(); format(kind); }
  }
  function insertLink() {
    if (!link || locked) return;
    try { apply(linkText(value, link.start, link.end, url)); }
    catch (err) { setError(err instanceof Error ? err.message : "Enter a valid URL."); }
  }

  return <div className="field description-field">
    <div className="label-row"><label htmlFor={id}>Description</label><div className="description-actions"><small className="mono">{value.length.toLocaleString()}/20,000</small><button type="button" className="format-preview" aria-pressed={preview} onClick={() => { setPreview(!preview); setLink(null); setError(""); }}><Icon name={preview ? "code" : "eye"} size={16} />{preview ? "Write" : "Preview"}</button></div></div>
    <div className={`description-editor${validationError ? " is-invalid" : ""}`}>
      <div className="format-toolbar" role="group" aria-label="Text formatting">
        {toolGroups.map((group, index) => <div className="format-tool-group" key={index}>
          {group.map(tool => <button key={tool.format} type="button" className={"format-button format-" + tool.format} aria-label={tool.label} title={tool.label + (tool.shortcut ? " (Ctrl/⌘+" + tool.shortcut + ")" : "")} disabled={locked} onMouseDown={e => e.preventDefault()} onClick={() => format(tool.format)}>{tool.icon ? <Icon name={tool.icon} size={18} /> : tool.glyph}</button>)}
          {index === toolGroups.length - 1 ? <button type="button" className="format-button" aria-label="Link" title="Insert link" disabled={locked} aria-expanded={!!link} aria-controls={id + "-link"} onMouseDown={e => e.preventDefault()} onClick={() => { setLink(link ? null : { start: input.current?.selectionStart ?? 0, end: input.current?.selectionEnd ?? 0 }); setUrl(""); setError(""); }}><Icon name="link" size={18} /></button> : null}
        </div>)}
      </div>
      {link && !locked ? <div className="format-link" id={id + "-link"}>
        <label className="field"><span>Link URL</span><input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" autoFocus onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); insertLink(); } if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setLink(null); input.current?.focus(); } }} /></label>
        <button type="button" className="button button-secondary" onClick={insertLink} disabled={!url.trim()}>Insert link</button>
        <button type="button" className="text-button" onClick={() => { setLink(null); input.current?.focus(); }}>Cancel</button>
      </div> : null}
      <textarea id={id} name="description" ref={input} rows={10} value={value} onChange={e => { onChange(e.target.value); setError(""); setLink(null); }} onKeyDown={shortcut} required minLength={20} maxLength={limit} readOnly={readOnly} hidden={preview} aria-invalid={validationError ? true : undefined} aria-describedby={`${id}-help${validationError ? ` ${id}-error` : ""}`} placeholder="Set the scene, state the objective, and say which files to use." onInvalid={() => { setPreview(false); requestAnimationFrame(() => input.current?.focus()); }} />
      {preview ? <div className="description-preview" role="region" aria-label="Formatted preview">{value.trim() ? <Content text={value} /> : <p className="muted">Write a description to preview it here.</p>}</div> : null}
    </div>
    {error ? <small role="alert" className="format-error">{error}</small> : null}
    {validationError ? <small id={`${id}-error`} className="field-error">{validationError}</small> : null}
    <small id={id + "-help"}>Select text and choose a style. Use Preview to see what players will read. The first sentence becomes the summary in the challenge list.</small>
  </div>;
}
