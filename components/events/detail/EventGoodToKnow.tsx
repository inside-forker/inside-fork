import {
  Accessibility,
  Armchair,
  Building2,
  Car,
  Check,
  PersonStanding,
  Sun,
  Users,
  UtensilsCrossed,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SECTION_TITLE } from "./styles";

/** Same shape as the app's `event_info` lists. */
export interface EventInfoLists {
  setting_tags: string[];
  amenities: string[];
  restrictions: string[];
}

const SETTING_ICONS: [RegExp, LucideIcon][] = [
  [/outdoor|open.?air/i, Sun],
  [/indoor/i, Building2],
  [/stand/i, PersonStanding],
  [/seat/i, Armchair],
];

const AMENITY_ICONS: [RegExp, LucideIcon][] = [
  [/park|valet/i, Car],
  [/wheelchair|accessib/i, Accessibility],
  [/food|drink|bar|dining/i, UtensilsCrossed],
  [/wi-?fi/i, Wifi],
  [/famil|all ages|kids|everyone/i, Users],
];

function iconFor(label: string, table: [RegExp, LucideIcon][]): LucideIcon | null {
  return table.find(([pattern]) => pattern.test(label))?.[1] ?? null;
}

function sentenceCase(parts: string[]): string {
  const joined = parts.map((p) => p.trim().toLowerCase()).filter(Boolean).join(", ");
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

/** "No pets" reads as "Pets" under a "Not allowed" heading. */
function restrictionChip(label: string): string {
  const bare = label.trim().replace(/^no\s+/i, "");
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}

/**
 * White tiles on a grey band: the setting (wide), one tile per amenity, then
 * "Not allowed" chips. Nothing renders when every list is empty.
 */
export function EventGoodToKnow({ info, className }: { info: EventInfoLists; className?: string }) {
  const setting = info.setting_tags.filter((t) => t.trim());
  const amenities = info.amenities.filter((t) => t.trim());
  const restrictions = info.restrictions.filter((t) => t.trim());
  if (setting.length === 0 && amenities.length === 0 && restrictions.length === 0) return null;

  const settingIcons = setting
    .map((t) => iconFor(t, SETTING_ICONS))
    .filter((icon): icon is LucideIcon => icon != null)
    .slice(0, 2);

  return (
    <section
      aria-labelledby="good-to-know-title"
      className={cn(
        "-mx-5 bg-muted px-5 pb-10 pt-9 md:mx-0 md:rounded-[28px] md:p-8",
        className,
      )}
    >
      <h2 id="good-to-know-title" className={cn(SECTION_TITLE, "mb-4 lg:mb-5")}>
        Good to know
      </h2>
      <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 lg:gap-3">
        {setting.length > 0 && (
          <li className="col-span-2 flex items-center gap-3.5 rounded-[20px] bg-background px-[18px] py-4 lg:gap-4 lg:px-[22px] lg:py-5">
            {settingIcons.length > 0 && (
              <div className="flex shrink-0 gap-1.5 lg:gap-2">
                {settingIcons.map((Icon, i) => (
                  <span key={i} className="grid h-11 w-11 place-items-center rounded-full bg-muted lg:h-[52px] lg:w-[52px]">
                    <Icon className="h-[22px] w-[22px]" strokeWidth={1.8} aria-hidden="true" />
                  </span>
                ))}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[17px] font-semibold leading-[1.3] lg:text-[22px] lg:font-bold lg:leading-[1.25] lg:tracking-[-0.015em]">
                {sentenceCase(setting)}
              </div>
              <div className="text-[13px] text-muted-foreground lg:text-[15px]">The setting</div>
            </div>
          </li>
        )}
        {amenities.map((label) => {
          const Icon = iconFor(label, AMENITY_ICONS) ?? Check;
          return (
            <li key={label} className="flex flex-col gap-3 rounded-[20px] bg-background p-4 lg:gap-3.5 lg:p-5">
              <Icon className="h-[22px] w-[22px]" strokeWidth={1.8} aria-hidden="true" />
              <div className="text-[15px] font-semibold leading-[1.3] lg:text-[17px]">{label}</div>
            </li>
          );
        })}
        {restrictions.length > 0 && (
          <li className="col-span-2 rounded-[20px] bg-background px-[18px] pb-[18px] pt-4 lg:col-span-3 lg:flex lg:flex-wrap lg:items-center lg:gap-x-4 lg:gap-y-3 lg:px-[22px] lg:py-5">
            <div className="text-[15px] font-semibold lg:text-[17px]">Not allowed</div>
            <div className="mt-2.5 flex flex-wrap gap-1.5 lg:mt-0 lg:gap-2">
              {restrictions.map((label) => (
                <span
                  key={label}
                  className="inline-flex h-8 items-center rounded-full bg-muted px-3 text-[13px] font-semibold lg:h-[34px] lg:px-3.5 lg:text-[15px]"
                >
                  {restrictionChip(label)}
                </span>
              ))}
            </div>
          </li>
        )}
      </ul>
    </section>
  );
}
