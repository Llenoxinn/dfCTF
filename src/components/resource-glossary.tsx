"use client";

import { useId, useState } from "react";
import { GLOSSARY } from "@/lib/resource-learning";

const terms = Object.keys(GLOSSARY);
const pattern = new RegExp(`\\b(${terms.sort((a, b) => b.length - a.length).join("|")})\\b`, "gi");

function Term({ word, definition }: { word: string; definition: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <span className="resource-term">
    <button type="button" aria-expanded={open} aria-controls={id} aria-label={`Explain ${word}`} onClick={() => setOpen(!open)} onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}>{word}</button>
    <span id={id} className="resource-definition" hidden={!open}> — {definition} </span>
  </span>;
}

export default function GlossaryText({ text }: { text: string }) {
  return text.split(pattern).map((part, index) => {
    const term = terms.find(term => term.toLowerCase() === part.toLowerCase());
    return term ? <Term key={index} word={part} definition={GLOSSARY[term]} /> : part;
  });
}
