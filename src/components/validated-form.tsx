"use client";

import { useId, useLayoutEffect, useRef, useState, type ComponentProps, type SubmitEvent as ReactSubmitEvent } from "react";

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type Feedback = { input: Control; message: string; label: string };

function feedbackFor(input: Control): Feedback {
  const label = input.labels?.[0];
  const title = input.getAttribute("aria-label") || (label?.querySelector("span") ?? label)?.textContent?.trim() || "Check this field";
  const validity = input.validity;
  let message = input.validationMessage;
  if (validity.valueMissing) message = "This field is required.";
  else if (validity.typeMismatch) message = input instanceof HTMLInputElement && input.type === "email" ? "Enter a valid email address." : "Enter a valid URL, including https://.";
  else if (validity.tooShort && "minLength" in input) message = `Use at least ${input.minLength} characters.`;
  else if (validity.tooLong && "maxLength" in input) message = `Use no more than ${input.maxLength} characters.`;
  else if (validity.patternMismatch) message = input.getAttribute("data-validation-message") || "Use the format shown for this field.";
  else if (validity.rangeUnderflow && "min" in input) message = `Enter a value of ${input.min} or more.`;
  else if (validity.rangeOverflow && "max" in input) message = `Enter a value of ${input.max} or less.`;
  else if (validity.stepMismatch) message = "Enter a value that matches the required step.";
  else if (validity.badInput) message = "Enter a valid value for this field.";
  return { input, message, label: title };
}

/** Keep native constraints, with dfCTF feedback instead of the browser's validation bubble. */
export default function ValidatedForm({ children, onSubmit, onInputCapture, onFocusCapture, ...props }: Omit<ComponentProps<"form">, "noValidate">) {
  const id = useId();
  const bubble = useRef<HTMLDivElement>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useLayoutEffect(() => {
    if (!feedback) return;
    const { input } = feedback, card = bubble.current!;
    if (!input.isConnected || !input.willValidate || input.validity.valid) { setFeedback(null); return; }
    const previousInvalid = input.getAttribute("aria-invalid");
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", [input.getAttribute("aria-describedby"), id].filter(Boolean).join(" "));
    card.showPopover();
    function position() {
      const target = input.getBoundingClientRect(), box = card.getBoundingClientRect();
      const left = Math.max(12, Math.min(target.left, window.innerWidth - box.width - 12));
      const below = target.bottom + 8;
      const top = below + box.height <= window.innerHeight - 12 ? below : Math.max(12, target.top - box.height - 8);
      card.style.left = `${left}px`; card.style.top = `${top}px`;
    }
    function dismiss(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setFeedback(null); }
    }
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !card.contains(event.target) && event.target !== input) setFeedback(null);
    }
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    document.addEventListener("keydown", dismiss, true);
    document.addEventListener("pointerdown", outside, true);
    return () => {
      card.hidePopover();
      const describedBy = (input.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(value => value && value !== id).join(" ");
      if (describedBy) input.setAttribute("aria-describedby", describedBy); else input.removeAttribute("aria-describedby");
      if (previousInvalid === null) input.removeAttribute("aria-invalid"); else input.setAttribute("aria-invalid", previousInvalid);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      document.removeEventListener("keydown", dismiss, true);
      document.removeEventListener("pointerdown", outside, true);
    };
  }, [feedback, id]);

  // A mode switch can remove the input or change its constraints without an input event.
  useLayoutEffect(() => {
    if (feedback && (!feedback.input.isConnected || !feedback.input.willValidate || feedback.input.validity.valid)) setFeedback(null);
  });

  function submit(event: ReactSubmitEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const skip = submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement ? submitter.formNoValidate : false;
    const invalid = skip ? undefined : Array.from(event.currentTarget.elements).find((element): element is Control =>
      (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) && element.willValidate && !element.validity.valid);
    if (invalid) {
      event.preventDefault();
      invalid.focus();
      setFeedback(feedbackFor(invalid));
      return;
    }
    setFeedback(null);
    onSubmit?.(event);
  }

  return <form {...props} noValidate onSubmit={submit} onInputCapture={event => {
    onInputCapture?.(event);
    if (feedback?.input === (event.target as EventTarget)) setFeedback(feedback.input.validity.valid ? null : feedbackFor(feedback.input));
  }} onFocusCapture={event => {
    onFocusCapture?.(event);
    if (feedback && (event.target as EventTarget) !== feedback.input && !bubble.current?.contains(event.target)) setFeedback(null);
  }}>
    {children}
    <div ref={bubble} id={id} className="validation-popover" popover="manual" role="alert">
      <span className="validation-mark mono" aria-hidden="true">[!]</span>
      <div><strong>{feedback?.label}</strong><p>{feedback?.message}</p></div>
    </div>
  </form>;
}
