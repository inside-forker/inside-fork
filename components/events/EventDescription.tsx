"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Event "About": the organizer's copy, muted and clamped to two lines, with
 * Read more / Show less. The toggle only appears when the text is cut off.
 */
export function EventDescription({ text, className }: { text: string; className?: string }) {
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
    <div className={className}>
      <p
        ref={ref}
        className={cn(
          "max-w-[680px] whitespace-pre-line text-small leading-relaxed text-muted-foreground lg:text-[15px]",
          !expanded && "line-clamp-2",
        )}
      >
        {text.trim()}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="h-9 text-small font-semibold text-foreground hover:underline lg:text-[15px]"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
