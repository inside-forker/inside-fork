"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BUSINESS_OWNER_CARD_SURFACE } from "@/components/business-owner/BusinessOwnerPageHeader";
import { cn } from "@/lib/utils";

export type AdminRedemptionRow = {
  id: string;
  status: string;
  code: string;
  channel: string | null;
  bill_value: string | number | null;
  discount_value: string | number | null;
  void_reason: string | null;
  listing_name: string;
  guest_name: string | null;
  guest_username: string | null;
  guest_id: string;
  staff_name: string | null;
  staff_username: string | null;
  owner_name: string | null;
  owner_username: string | null;
  created_at: string;
  validated_at: string | null;
  voided_at: string | null;
};

type LookupResult = {
  id: string;
  status: string;
  code: string;
  listingName: string;
  discountLabel: string | null;
  userName: string | null;
  expiresAt: string;
};

function personLabel(
  name: string | null,
  username: string | null,
  fallback = "—",
): string {
  const n = name?.trim();
  const u = username?.trim();
  if (n && u) return `${n} (@${u})`;
  if (n) return n;
  if (u) return `@${u}`;
  return fallback;
}

/** Deterministic label — avoids SSR/client ICU differences ("Sep 6, 9:22 PM" vs "Sep 6 at 9:22 PM"). */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("month")} ${get("day")}, ${get("hour")}:${get("minute")} ${get("dayPeriod")}`;
}

export function AdminRedemptionsClient({
  recent,
}: {
  recent: AdminRedemptionRow[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLDivElement>(null);
  const [code, setCode] = useState("");
  const [billValue, setBillValue] = useState("");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    billValue: number;
    discountValue: number | null;
    code: string;
  } | null>(null);
  const [pendingAcceptId, setPendingAcceptId] = useState<string | null>(null);

  const runLookup = useCallback(async (rawCode: string) => {
    setError(null);
    setSuccess(null);
    setLookup(null);
    const trimmed = rawCode.trim().toUpperCase();
    if (!trimmed) {
      setError("Enter a redemption code.");
      return;
    }
    setCode(trimmed);
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
  }, []);

  const handleAcceptRow = (row: AdminRedemptionRow) => {
    setPendingAcceptId(row.id);
    setBillValue("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    void runLookup(row.code);
  };

  useEffect(() => {
    if (lookup && pendingAcceptId) {
      setPendingAcceptId(null);
    }
  }, [lookup, pendingAcceptId]);

  const handleValidate = async () => {
    setError(null);
    setSuccess(null);
    const bill = Number(billValue);
    if (!Number.isFinite(bill) || bill <= 0) {
      setError("Enter a valid bill amount (PKR).");
      return;
    }
    const trimmed = code.trim().toUpperCase();
    setSubmitting(true);
    try {
      const res = await fetch("/api/business/redemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: trimmed,
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
        code: trimmed,
      });
      setLookup((prev) => (prev ? { ...prev, status: "validated" } : prev));
      setBillValue("");
      router.refresh();
    } catch {
      setError("Validation failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <Card
        ref={formRef}
        className={cn("max-w-lg", BUSINESS_OWNER_CARD_SURFACE)}
      >
        <CardHeader>
          <CardTitle>Validate for merchant</CardTitle>
          <CardDescription>
            Admin / super admin can confirm any pending guest code on behalf of
            the venue. Enter bill value (pre-discount), then confirm.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-redeem-code">Redemption code</Label>
            <div className="flex gap-2">
              <Input
                id="admin-redeem-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="RD-XXXXXXXX"
                className="font-mono uppercase"
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void runLookup(code)}
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
              <Label htmlFor="admin-redeem-bill">Bill value (PKR)</Label>
              <Input
                id="admin-redeem-bill"
                type="number"
                min={1}
                step="0.01"
                value={billValue}
                onChange={(e) => setBillValue(e.target.value)}
                placeholder="e.g. 4500"
                autoFocus
              />
              <Button
                type="button"
                className="w-full"
                onClick={() => void handleValidate()}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Accept for merchant"
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
                <p className="font-medium">
                  Accepted {success.code} for the merchant
                </p>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent redemptions</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No redemptions yet (or migration not applied).
            </p>
          ) : (
            <div className="rounded-xl border border-border/50 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Validated by</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Listing</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Bill</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatWhen(row.created_at)}
                        {row.validated_at ? (
                          <span className="block text-xs">
                            ok {formatWhen(row.validated_at)}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">
                          {personLabel(
                            row.guest_name,
                            row.guest_username,
                            "Unknown guest",
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono truncate max-w-[140px]">
                          {row.guest_id}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.status === "validated" ||
                        row.staff_name ||
                        row.staff_username
                          ? personLabel(row.staff_name, row.staff_username, "—")
                          : "—"}
                        {row.channel ? (
                          <span className="block text-xs text-muted-foreground">
                            via {row.channel}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        {personLabel(row.owner_name, row.owner_username)}
                      </TableCell>
                      <TableCell>{row.listing_name}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.code}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.status === "validated"
                              ? "secondary"
                              : row.status === "pending"
                                ? "outline"
                                : "destructive"
                          }
                        >
                          {row.status}
                        </Badge>
                        {row.void_reason ? (
                          <span className="block text-xs text-muted-foreground mt-1 max-w-[160px]">
                            {row.void_reason}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.bill_value != null
                          ? Number(row.bill_value).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.discount_value != null
                          ? Number(row.discount_value).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.status === "pending" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            disabled={loading && pendingAcceptId === row.id}
                            onClick={() => handleAcceptRow(row)}
                          >
                            {loading && pendingAcceptId === row.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              "Accept"
                            )}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
