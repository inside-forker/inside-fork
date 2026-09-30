"use client";

import { ShieldCheck } from "lucide-react";

/** Checkout page header: eyebrow, one display title, one line of context. */
export function CheckoutHeader() {
    return (
        <div className="mb-8 space-y-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-primary">
                <ShieldCheck className="h-4 w-4" aria-hidden />
                Secure checkout
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Checkout
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
                Review your order and pay securely. You&apos;re a few steps away.
            </p>
        </div>
    );
}
