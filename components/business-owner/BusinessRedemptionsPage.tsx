"use client";

import { useState } from "react";
import { Ticket, Loader2, CheckCircle2 } from "lucide-react";
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
import {
  BusinessOwnerPageHeader,
  BUSINESS_OWNER_CARD_SURFACE,
} from "@/components/business-owner/BusinessOwnerPageHeader";
import { cn } from "@/lib/utils";

type LookupResult = {
  id: string;
  status: string;
  code: string;
  listingName: string;
  discountLabel: string | null;
  userName: string | null;
  expiresAt: string;
};

export function BusinessRedemptionsPage({
  compact = false,
}: {
  /** When true, skip the business-owner page header (e.g. embedded in admin). */
  compact?: boolean;
}) {
  const [code, setCode] = useState("");
  const [billValue, setBillValue] = useState("");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    billValue: number;
    discountValue: number | null;
  } | null>(null);

  const handleLookup = async () => {
    setError(null);
    setSuccess(null);
    setLookup(null);
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Enter a redemption code.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/business/redemptions?code=${encodeURIComponent(trimmed)}`,
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Code not found.");
        return;
      }
      setLookup(json.data as LookupResult);
      if (json.data.status !== "pending") {
        setError(`This code is ${json.data.status}.`);
      }
    } catch {
      setError("Lookup failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    setError(null);
    setSuccess(null);
    const bill = Number(billValue);
    if (!Number.isFinite(bill) || bill <= 0) {
      setError("Enter a valid bill amount (PKR).");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/business/redemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          billValue: bill,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Validation failed.");
        return;
      }
      setSuccess({
        billValue: json.data.billValue,
        discountValue: json.data.discountValue,
      });
      setLookup((prev) => (prev ? { ...prev, status: "validated" } : prev));
      setBillValue("");
    } catch {
      setError("Validation failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      {!compact && (
        <BusinessOwnerPageHeader
          icon={Ticket}
          title="Redeem offers"
          description="Enter a customer code and the bill total to record GMV"
        />
      )}

      <Card className={cn("max-w-lg", BUSINESS_OWNER_CARD_SURFACE)}>
        <CardHeader>
          <CardTitle>Validate redemption</CardTitle>
          <CardDescription>
            Ask the guest for the short code from their app, then enter the
            pre-discount bill value.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Redemption code</Label>
            <div className="flex gap-2">
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="RD-XXXXXXXX"
                className="font-mono uppercase"
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleLookup}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Lookup"
                )}
              </Button>
            </div>
          </div>

          {lookup && (
            <div className="rounded-xl border border-border/50 bg-muted/30 p-4 text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Listing:</span>{" "}
                {lookup.listingName}
              </p>
              {lookup.discountLabel && (
                <p>
                  <span className="text-muted-foreground">Offer:</span>{" "}
                  {lookup.discountLabel}
                </p>
              )}
              {lookup.userName && (
                <p>
                  <span className="text-muted-foreground">Guest:</span>{" "}
                  {lookup.userName}
                </p>
              )}
              <p>
                <span className="text-muted-foreground">Status:</span>{" "}
                {lookup.status}
              </p>
            </div>
          )}

          {lookup?.status === "pending" && (
            <div className="space-y-2">
              <Label htmlFor="bill">Bill value (PKR)</Label>
              <Input
                id="bill"
                type="number"
                min={1}
                step="0.01"
                value={billValue}
                onChange={(e) => setBillValue(e.target.value)}
                placeholder="e.g. 4500"
              />
              <Button
                type="button"
                className="w-full"
                onClick={handleValidate}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Confirm redemption"
                )}
              </Button>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {success && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Redemption recorded</p>
                <p className="text-muted-foreground">
                  Bill Rs {success.billValue.toLocaleString()}
                  {success.discountValue != null
                    ? ` · guest saved ~Rs ${success.discountValue.toLocaleString()}`
                    : ""}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
