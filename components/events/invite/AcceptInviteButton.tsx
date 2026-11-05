"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** Claims the code for the logged-in user, then opens the event. */
export function AcceptInviteButton({ code }: { code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/invites/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't accept the invite. Try again.");
        // Someone else claimed it in the meantime: show the "used" screen.
        if (res.status === 409) router.refresh();
        return;
      }
      router.replace(data.redirect);
    } catch {
      setError("Couldn't reach Inside. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button size="lg" className="h-12 w-full rounded-control text-body" onClick={accept} disabled={busy}>
        {busy ? "Accepting…" : "Accept invite"}
      </Button>
      {error && (
        <p role="alert" className="text-small text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
