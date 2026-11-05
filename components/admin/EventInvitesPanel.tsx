"use client";

import * as React from "react";
import { Download, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface Counts {
  total: number;
  claimed: number;
  booked: number;
}

/**
 * Invite-only events: generate one-time invite links and download them as a
 * CSV to send out. Each link locks to the first account that accepts it.
 */
export function EventInvitesPanel({ eventId }: { eventId: number }) {
  const { toast } = useToast();
  const [counts, setCounts] = React.useState<Counts | null>(null);
  const [count, setCount] = React.useState("50");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/admin/events/${eventId}/invites`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.counts) setCounts(data.counts);
  }, [eventId]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1) {
      toast({ title: "Enter how many invites to create", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: n }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create invites");
      toast({ title: `${data.created} invites created` });
      await load();
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to create invites",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 text-muted-foreground" />
        <div>
          <h4 className="text-base font-semibold">Invite links</h4>
          <p className="text-xs text-muted-foreground">
            This event is hidden everywhere. Send each guest their own link: it locks to the
            first account that accepts it, and that account can buy one ticket.
          </p>
        </div>
      </div>

      {counts && (
        <p className="text-sm">
          {counts.total} created · {counts.claimed} accepted · {counts.booked} booked
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="invite_count" className="text-sm font-medium">
            New invites
          </Label>
          <Input
            id="invite_count"
            type="number"
            min="1"
            max="1000"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="h-10 w-28"
          />
        </div>
        <Button type="button" variant="solid" onClick={generate} disabled={busy}>
          {busy ? "Creating…" : "Create invites"}
        </Button>
        <Button type="button" variant="outline" asChild disabled={!counts?.total}>
          <a href={`/api/admin/events/${eventId}/invites?format=csv`} download>
            <Download className="h-4 w-4" />
            Download CSV
          </a>
        </Button>
      </div>
    </div>
  );
}
