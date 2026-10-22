"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  newFieldId,
  type AttendeeField,
  type AttendeeFieldType,
} from "@/lib/ticketing/attendee-fields";

const TYPE_LABELS: Record<AttendeeFieldType, string> = {
  text: "Text",
  number: "Number",
  email: "Email",
  phone: "Phone",
  select: "Dropdown",
};

const selectClass =
  "h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

/**
 * Edits the extra questions a buyer answers at checkout ("University name",
 * "Student ID"). Used for event-wide fields and for a single ticket type.
 * Dropdown options are typed comma-separated.
 */
export function AttendeeFieldsEditor({
  value,
  onChange,
}: {
  value: AttendeeField[];
  onChange: (next: AttendeeField[]) => void;
}) {
  const update = (index: number, patch: Partial<AttendeeField>) =>
    onChange(value.map((f, i) => (i === index ? { ...f, ...patch } : f)));

  return (
    <div className="space-y-3">
      {value.map((field, index) => (
        <div key={field.id} className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <Input
              value={field.label}
              onChange={(e) => update(index, { label: e.target.value })}
              placeholder="Field name, e.g. University name"
              aria-label="Field name"
              className="h-9"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-destructive"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              aria-label="Remove field"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={field.type}
              onChange={(e) =>
                update(index, { type: e.target.value as AttendeeFieldType })
              }
              aria-label="Answer type"
              className={selectClass}
            >
              {Object.entries(TYPE_LABELS).map(([type, label]) => (
                <option key={type} value={type}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={field.scope}
              onChange={(e) =>
                update(index, {
                  scope: e.target.value === "order" ? "order" : "person",
                })
              }
              aria-label="Who answers"
              className={selectClass}
            >
              <option value="person">Every person</option>
              <option value="order">Once per booking</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={field.required}
                onCheckedChange={(checked) => update(index, { required: checked })}
              />
              Required
            </label>
          </div>
          {field.type === "select" ? (
            <Input
              defaultValue={(field.options ?? []).join(", ")}
              onBlur={(e) =>
                update(index, {
                  options: e.target.value
                    .split(",")
                    .map((o) => o.trim())
                    .filter(Boolean),
                })
              }
              placeholder="Options, comma separated"
              aria-label="Dropdown options"
              className="h-9"
            />
          ) : null}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([
            ...value,
            {
              id: newFieldId(),
              label: "",
              type: "text",
              required: true,
              scope: "person",
            },
          ])
        }
      >
        <Plus className="mr-1.5 h-4 w-4" />
        Add field
      </Button>
    </div>
  );
}

/**
 * Group size as a range: min people required per ticket, max it admits.
 * 1–1 = a normal ticket; 3–3 = a fixed team of 3; 2–3 = a team of 2 with an
 * optional third person.
 */
export function GroupSizeInputs({
  min,
  max,
  onChange,
}: {
  min: string;
  max: string;
  onChange: (next: { min: string; max: string }) => void;
}) {
  return (
    <div className="space-y-2 md:col-span-2">
      <Label>People per ticket (group size)</Label>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="people-min" className="text-xs text-muted-foreground">
            Minimum
          </Label>
          <Input
            id="people-min"
            type="number"
            min={1}
            max={10}
            value={min}
            onChange={(e) => onChange({ min: e.target.value, max })}
            placeholder="1"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="people-max" className="text-xs text-muted-foreground">
            Maximum
          </Label>
          <Input
            id="people-max"
            type="number"
            min={1}
            max={10}
            value={max}
            onChange={(e) => onChange({ min, max: e.target.value })}
            placeholder="1"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        How many people one ticket lets in. 1 and 1 is a normal ticket. For a
        team of 2–3, set 2 and 3: two people are required and a third can be
        added at checkout. Each person gets their own QR and details.
      </p>
    </div>
  );
}
