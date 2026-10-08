"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  configured: boolean;
};

export function TicketPdfInventoryPasscodeGate({ configured }: Props) {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!configured || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ticket-pdf-inventory/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(
          typeof json.error === "string"
            ? json.error
            : "Incorrect passcode.",
        );
      }
      setPasscode("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md border-border/60">
        <CardHeader className="space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">Passcode required</CardTitle>
          <CardDescription>
            This inventory is locked even for admins. Enter the shared ops
            passcode to continue. Inspect element cannot unlock this page —
            data is only loaded after the server accepts the passcode.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!configured ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              Gate not configured. Set{" "}
              <code className="font-mono text-xs">
                TICKET_PDF_INVENTORY_PASSCODE
              </code>{" "}
              on the server.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pdf-inv-passcode">Passcode</Label>
                <Input
                  id="pdf-inv-passcode"
                  type="password"
                  autoComplete="off"
                  autoFocus
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter passcode"
                  disabled={submitting}
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={submitting || !passcode.trim()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking…
                  </>
                ) : (
                  "Unlock inventory"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
