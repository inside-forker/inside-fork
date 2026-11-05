"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Split the organizer's copy into an opening sentence (set large) and the
 * rest. No lead when the first sentence is too short or too long to carry it.
 */
function splitLead(text: string): { lead: string | null; rest: string } {
  const trimmed = text.trim();
  const firstLine = trimmed.split(/\n/)[0].trim();
  const sentence = firstLine.match(/^(.+?[.!?])(?=\s|$)/)?.[1] ?? firstLine;
  if (sentence.length < 24 || sentence.length > 240) return { lead: null, rest: trimmed };
  return { lead: sentence, rest: trimmed.slice(trimmed.indexOf(sentence) + sentence.length).trim() };
}

/**
 * Event "About": the opening sentence large, the rest muted and clamped with
 * Read more / Show less. The toggle only appears when the text is cut off.
 */
export function EventDescription({ text }: { text: string }) {
  const { lead, rest } = splitLead(text);
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div>
      {lead && (
        <p className="max-w-[700px] text-xl font-semibold leading-[1.4] tracking-[-0.01em] lg:text-2xl lg:leading-[1.38] lg:tracking-[-0.015em]">
          {lead}
        </p>
      )}
      {rest && (
        <p
          ref={ref}
          className={cn(
            "max-w-[680px] whitespace-pre-line text-[17px] leading-[1.53] lg:leading-[1.6]",
            lead ? "mt-3 text-muted-foreground lg:mt-4" : "text-foreground",
            !expanded && (lead ? "line-clamp-3" : "line-clamp-5"),
          )}
        >
          {rest}
        </p>
      )}
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-0.5 h-11 text-[17px] font-semibold text-foreground hover:underline lg:mt-1"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
