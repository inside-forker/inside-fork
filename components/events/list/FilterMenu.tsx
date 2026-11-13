"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Radix radio items need a non-empty value, so "any" gets a sentinel. */
const ANY = "__any";

export interface FilterMenuOption {
  value: string;
  label: string;
  /** Events this option would show with the other filters as they are. */
  count: number;
}

/**
 * A filter pill ("Date", "Area"…) that opens a short menu. Each option shows
 * how many events it leaves, and options that would leave none are greyed
 * out. A set filter turns the pill pink and shows its value.
 */
export function FilterMenu({
  title,
  anyLabel,
  anyCount,
  value,
  options,
  onChange,
  align = "start",
}: {
  title: string;
  anyLabel: string;
  anyCount: number;
  value: string | null;
  options: FilterMenuOption[];
  onChange: (value: string | null) => void;
  align?: "start" | "end";
}) {
  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={selected ? `${title}: ${selected.label}` : title}
        className={cn(
          "group inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-full pl-[13px] pr-2.5 text-data font-semibold outline-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:h-10 lg:text-small",
          selected
            ? "bg-primary text-primary-foreground hover:opacity-90"
            : "bg-muted text-foreground hover:bg-border data-[state=open]:bg-border",
        )}
      >
        <span>{selected ? selected.label : title}</span>
        <ChevronDown
          className="h-3.5 w-3.5 transition-transform duration-fast group-data-[state=open]:rotate-180"
          strokeWidth={2.2}
          aria-hidden="true"
        />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={6}
          collisionPadding={16}
          className="z-50 w-56 rounded-media border border-border bg-background p-1.5 text-foreground shadow-overlay"
        >
          <DropdownMenu.RadioGroup value={value ?? ANY} onValueChange={(v) => onChange(v === ANY ? null : v)}>
            <MenuItem value={ANY} label={anyLabel} count={anyCount} />
            {options.map((o) => (
              <MenuItem
                key={o.value}
                value={o.value}
                label={o.label}
                count={o.count}
                disabled={o.count === 0 && o.value !== value}
              />
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuItem({
  value,
  label,
  count,
  disabled = false,
}: {
  value: string;
  label: string;
  count: number;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu.RadioItem
      value={value}
      disabled={disabled}
      className="group/item flex h-10 cursor-pointer select-none items-center justify-between gap-3 rounded-control px-2.5 text-small font-medium outline-none data-[disabled]:cursor-default data-[highlighted]:bg-muted data-[state=checked]:bg-muted data-[state=checked]:font-bold data-[disabled]:opacity-40"
    >
      <span>{label}</span>
      <span className="text-data font-medium tabular-nums text-muted-foreground group-data-[state=checked]/item:hidden">
        {count}
      </span>
      <DropdownMenu.ItemIndicator>
        <Check className="h-4 w-4 text-primary" strokeWidth={2.4} aria-hidden="true" />
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.RadioItem>
  );
}
