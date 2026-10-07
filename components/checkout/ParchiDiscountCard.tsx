"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, GraduationCap, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { describeParchiOffer, type ParchiOffer } from "@/lib/parchi/discount";
import { recallParchiId } from "@/lib/parchi/prefill";

type Status = "pending" | "approved" | "rejected" | "expired";

interface Verification {
  id: string;
  status: Status;
  match_code: string | null;
  verify_web_link: string;
  expires_at: string;
}

interface ParchiDiscountCardProps {
  eventId: number;
  offer: ParchiOffer;
  /** Verifying needs an account; logged out, the card offers a login. */
  isLoggedIn: boolean;
  onLogin: () => void;
  /** Approved verification id, or null when none / removed. */
  onApprovedChange: (verificationId: string | null) => void;
}

/**
 * "Student? Verify with Parchi" block. Parchi's required UX: after starting,
 * show "Check your Parchi app", the match code large, and a QR of
 * verify_web_link; on rejected/expired offer Resend. The discount is applied
 * only from an approved status the server got from Parchi.
 */
export function ParchiDiscountCard({
  eventId,
  offer,
  isLoggedIn,
  onLogin,
  onApprovedChange,
}: ParchiDiscountCardProps) {
  const [parchiId, setParchiId] = useState("");
  // Pre-fill from the Parchi app's link (?parchiId= on the event page). Read
  // after mount: sessionStorage doesn't exist during server rendering.
  useEffect(() => {
    const remembered = recallParchiId();
    if (remembered) setParchiId((current) => current || remembered);
  }, []);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = null;
  };
  useEffect(() => stopPolling, []);

  const poll = (id: string, startedAt: number, expiresAt: number) => {
    const elapsed = Date.now() - startedAt;
    pollTimer.current = setTimeout(
      async () => {
        // Parchi decides expiry, but stop asking a few seconds past it.
        if (Date.now() > expiresAt + 5000) {
          setVerification((v) => (v ? { ...v, status: "expired" } : v));
          return;
        }
        try {
          const res = await fetch(`/api/parchi/verifications/${id}`);
          if (res.ok) {
            const next = (await res.json()) as Verification;
            setVerification(next);
            if (next.status === "approved") {
              onApprovedChange(next.id);
              return;
            }
            if (next.status !== "pending") return;
          }
        } catch {
          // Network blip - keep polling.
        }
        poll(id, startedAt, expiresAt);
      },
      elapsed < 30_000 ? 3000 : 5000,
    );
  };

  const start = async () => {
    stopPolling();
    setError(null);
    setIsStarting(true);
    try {
      const res = await fetch("/api/parchi/verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, parchiId: parchiId.trim() }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Couldn't start verification. Please try again.");
        return;
      }
      const next = body as Verification;
      setVerification(next);
      if (next.status === "approved") {
        onApprovedChange(next.id);
      } else if (next.status === "pending") {
        poll(next.id, Date.now(), new Date(next.expires_at).getTime());
      }
    } catch {
      setError("Couldn't start verification. Please try again.");
    } finally {
      setIsStarting(false);
    }
  };

  const reset = () => {
    stopPolling();
    setVerification(null);
    setError(null);
    onApprovedChange(null);
  };

  const status = verification?.status;

  return (
    <Card className="rounded-2xl border bg-card shadow-none">
      <CardContent className="space-y-3.5 p-4">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-[22px] w-[22px] shrink-0 text-foreground" />
          <div>
            <h3 className="text-sm font-semibold">Student? Verify with Parchi</h3>
            <p className="text-xs text-muted-foreground">
              {describeParchiOffer(offer)} for verified Parchi students.
            </p>
          </div>
        </div>

        {!isLoggedIn ? (
          <Button variant="outline" className="w-full" onClick={onLogin}>
            Log in to use your student discount
          </Button>
        ) : status === "approved" ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-primary/5 p-4">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Student discount applied
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              Remove
            </Button>
          </div>
        ) : status === "pending" && verification ? (
          <div className="flex flex-col sm:flex-row items-center gap-6 rounded-xl bg-muted/40 p-5">
            <div className="flex-1 text-center sm:text-left space-y-2">
              <p className="font-semibold">Check your Parchi app</p>
              <p className="text-sm text-muted-foreground">Tap this number:</p>
              <p className="text-6xl font-bold tracking-wider text-primary">
                {verification.match_code}
              </p>
              <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Waiting for approval…
              </p>
            </div>
            <div className="text-center space-y-2">
              <div className="rounded-lg bg-white p-2 inline-block">
                <QRCodeSVG value={verification.verify_web_link} size={132} />
              </div>
              <p className="text-xs text-muted-foreground max-w-[150px]">
                On a laptop? Scan with the Parchi app.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {(status === "rejected" || status === "expired") && (
              <p className="text-sm text-destructive">
                {status === "rejected"
                  ? "Verification was declined in the Parchi app."
                  : "Verification timed out. Tap Resend to try again."}
              </p>
            )}
            <div className="flex gap-2">
              <Input
                value={parchiId}
                onChange={(e) =>
                  setParchiId(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 10))
                }
                placeholder="Your Parchi ID"
                inputMode="text"
                autoComplete="off"
                disabled={isStarting}
              />
              {/* Dark, like the app: pink is kept for the pay button. */}
              <Button
                onClick={start}
                disabled={isStarting || !parchiId.trim()}
                className="min-w-[84px] bg-[#111827] text-white hover:bg-[#111827]/90"
              >
                {isStarting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : status ? (
                  <>
                    <RotateCw className="mr-1.5 h-4 w-4" />
                    Resend
                  </>
                ) : (
                  "Verify"
                )}
              </Button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
