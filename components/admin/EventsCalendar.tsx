"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { statusTone } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import type { AdminEvent } from "@/types/events.types";

const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DOT: Record<string, string> = {
  positive: "bg-success",
  attention: "bg-warning",
  negative: "bg-destructive",
  neutral: "bg-muted-foreground",
  ended: "ring-1 ring-inset ring-muted-foreground",
};

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Month grid of the loaded events (Monday first). Clicking an event opens it. */
export function EventsCalendar({
  events,
  onOpenEvent,
}: {
  events: AdminEvent[];
  onOpenEvent: (event: AdminEvent) => void;
}) {
  const [month, setMonth] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const byDay = React.useMemo(() => {
    const map = new Map<string, AdminEvent[]>();
    for (const e of events) {
      const key = dayKey(new Date(e.start_time));
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    map.forEach((list) => list.sort((a, b) => a.start_time.localeCompare(b.start_time)));
    return map;
  }, [events]);

  // 6 weeks from the Monday on or before the 1st.
  const start = new Date(month);
  start.setDate(1 - ((month.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const todayKey = dayKey(new Date());
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  return (
    <div>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <h3 className="text-base font-semibold" aria-live="polite">
          {monthFmt.format(month)}
        </h3>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="icon-xs" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => {
              const now = new Date();
              setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
            }}
          >
            Today
          </Button>
          <Button variant="outline" size="icon-xs" aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div role="grid" aria-label={`Events in ${monthFmt.format(month)}`} className="grid min-w-[theme(screens.md)] grid-cols-7">
          {WEEKDAYS.map((d) => (
            <div key={d} role="columnheader" className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
          {days.map((d, i) => {
            const inMonth = d.getMonth() === month.getMonth();
            const key = dayKey(d);
            const list = byDay.get(key) ?? [];
            return (
              <div
                key={key}
                role="gridcell"
                className={cn(
                  "flex min-h-28 min-w-0 flex-col gap-1 border-b p-2",
                  (i + 1) % 7 !== 0 && "border-r",
                  !inMonth && "bg-muted/40",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full text-data font-medium tabular-nums",
                    key === todayKey ? "bg-primary text-primary-foreground" : !inMonth && "text-muted-foreground",
                  )}
                >
                  {d.getDate()}
                </span>
                {list.map((e) => (
                  <button
                    key={e.event_id}
                    type="button"
                    onClick={() => onOpenEvent(e)}
                    className="flex min-w-0 items-start gap-2 rounded-md border bg-background px-2 py-1 text-left text-xs transition-colors duration-150 hover:bg-muted"
                  >
                    <span aria-hidden="true" className={cn("mt-1 size-1.5 shrink-0 rounded-full", DOT[statusTone(e.event_status)])} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{e.event_name}</span>
                      <span className="block tabular-nums text-muted-foreground">{timeFmt.format(new Date(e.start_time))}</span>
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
