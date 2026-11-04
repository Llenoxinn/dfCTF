"use client";

import { useEffect, useId, useRef } from "react";
import LineSidebar, { PAGE_INDEX, type LineSidebarItem } from "./line-sidebar";
import { Icon } from "./ui";

export default function RulesNavigation({ items }: { items: LineSidebarItem[] }) {
  const id = useId();
  const disclosure = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);

  useEffect(() => {
    const details = disclosure.current!;
    const layout = details.closest<HTMLElement>(".rules-layout")!;
    const header = details.closest("main")?.previousElementSibling;
    // The public header and signed-in tab bar have different heights, including at text zoom.
    const measure = () => {
      if (header) layout.style.setProperty("--rules-header-height", `${header.getBoundingClientRect().height}px`);
      layout.style.setProperty("--rules-control-height", `${trigger.current!.getBoundingClientRect().height}px`);
    };
    const observer = new ResizeObserver(measure);
    if (header) observer.observe(header);
    observer.observe(trigger.current!);
    measure();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !details.contains(event.target)) details.open = false;
    };
    document.addEventListener("pointerdown", outside);
    return () => { observer.disconnect(); document.removeEventListener("pointerdown", outside); };
  }, []);

  function close() {
    // Move focus out of the panel before hiding it so browser focus repair cannot override it.
    trigger.current?.focus({ preventScroll: true });
    disclosure.current!.open = false;
  }

  return <div className="rules-navigation">
    <LineSidebar className="rules-index" label="Rules sections" items={items} spy {...PAGE_INDEX} />
    <details ref={disclosure} className="rules-sections" onToggle={event => {
      // Opening near the bottom of a short viewport must reveal the whole menu, including its close button.
      if (event.currentTarget.open) event.currentTarget.querySelector(".rules-sections-panel")?.scrollIntoView({ block: "nearest", behavior: "instant" });
    }} onKeyDown={event => {
      if (event.key === "Escape" && disclosure.current?.open) { event.preventDefault(); event.stopPropagation(); close(); }
      // Safari moves focus outside the disclosure during a touch tap, before the link's click can run.
      if (event.key === "Tab") requestAnimationFrame(() => {
        const details = disclosure.current;
        if (details && !details.contains(document.activeElement)) details.open = false;
      });
    }}>
      <summary ref={trigger} aria-controls={id}>Sections<Icon name="down" size={18} /></summary>
      <div id={id} className="rules-sections-panel">
        <button type="button" className="text-button rules-sections-close" onClick={close}>Close sections<Icon name="close" size={18} /></button>
        <nav aria-label="Rules sections"><ul>
          {/* Explicit tab stops keep these links reachable with Safari's default keyboard settings. */}
          {items.map(item => <li key={item.href}><a href={item.href} tabIndex={0} onClick={event => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            disclosure.current!.open = false;
            // A deferred focus can steal it from the user's next keyboard action.
            document.getElementById(item.href.slice(1))?.focus({ preventScroll: true });
          }}>{item.label}</a></li>)}
        </ul></nav>
      </div>
    </details>
  </div>;
}
