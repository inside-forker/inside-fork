/**
 * PayFast Success Callback Page
 *
 * Handles browser redirects from PayFast after payment. Validates the callback,
 * then fulfills the booking via the same webhook path (mark paid, create passes,
 * send ticket email). IPN alone is not enough for local/dev because PayFast
 * cannot reach localhost CHECKOUT_URL.
 */

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import {
  validatePayFastCallback,
  normalizePayFastStatus,
} from "@/lib/payments/payfast";
import { CheckoutSuccessContent } from "@/components/checkout/CheckoutSuccessContent";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function flattenParams(
  params: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/**
 * Re-post the PayFast result to our IPN handler so booking fulfillment and
 * ticket emails run even when PayFast's server-to-server IPN never arrives
 * (localhost, blocked tunnels, etc.). The handler is idempotent for already-paid
 * bookings.
 */
async function fulfillPayFastRedirect(
  flat: Record<string, string>,
): Promise<void> {
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");

  const body = new URLSearchParams(flat);
  try {
    const res = await fetch(`${baseUrl}/api/payments/payfast/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      // Server-side; don't cache
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        "[PayFast Success] Fulfillment callback failed:",
        res.status,
        text.slice(0, 300),
      );
    } else {
      console.log("[PayFast Success] Fulfillment callback ok");
    }
  } catch (err) {
    console.error("[PayFast Success] Fulfillment callback error:", err);
  }
}

async function SuccessContent({ searchParams }: PageProps) {
  const params = await searchParams;

  const basketId = typeof params.basket_id === "string" ? params.basket_id : "";
  const errCode = typeof params.err_code === "string" ? params.err_code : "";
  const errMsg = typeof params.err_msg === "string" ? params.err_msg : "";
  const transactionId =
    typeof params.transaction_id === "string" ? params.transaction_id : "";

  const previewMode =
    typeof params.preview === "string" ? params.preview : null;

  if (
    previewMode &&
    process.env.NODE_ENV === "development" &&
    ["paid", "pending", "security_failed"].includes(previewMode)
  ) {
    console.log(`[Checkout Success] PREVIEW MODE: ${previewMode}`);
    return (
      <CheckoutSuccessContent
        status={previewMode as "paid" | "pending" | "security_failed"}
        basketId={basketId || "PREVIEW-BASKET-123"}
        transactionId={transactionId || "PREVIEW-TXN-456"}
        errCode={errCode || "N/A"}
        errMsg={errMsg}
      />
    );
  }

  let isValid = false;
  let normalizedStatus: "paid" | "failed" | "pending" = "pending";
  const flat = flattenParams(params);

  try {
    const validationResult = validatePayFastCallback({
      basket_id: basketId,
      err_code: errCode,
      err_msg: errMsg,
      transaction_id: transactionId,
      ...flat,
    });

    isValid = validationResult.isValid;
    normalizedStatus = normalizePayFastStatus(errCode);
  } catch (error) {
    console.error("[PayFast Success] Validation error:", error);
  }

  if (!isValid) {
    return (
      <CheckoutSuccessContent
        status="security_failed"
        basketId={basketId}
        transactionId={transactionId}
        errCode={errCode}
        errMsg={errMsg}
      />
    );
  }

  // Confirm booking + send ticket email (same path as IPN).
  if (normalizedStatus === "paid" || normalizedStatus === "pending") {
    await fulfillPayFastRedirect(flat);
  }

  const status: "paid" | "pending" =
    normalizedStatus === "paid" ? "paid" : "pending";

  return (
    <CheckoutSuccessContent
      status={status}
      basketId={basketId}
      transactionId={transactionId}
      errCode={errCode}
      errMsg={errMsg}
    />
  );
}

export default function PayFastSuccessPage(props: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <SuccessContent {...props} />
    </Suspense>
  );
}
