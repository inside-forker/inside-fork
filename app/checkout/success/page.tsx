import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import {
  validatePayFastCallback,
  normalizePayFastStatus,
} from "@/lib/payments/payfast";
import { processPayFastCallbackParams } from "@/lib/payments/processPayFastCallback";
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
        emailSent={previewMode === "paid"}
      />
    );
  }

  let isValid = false;
  let normalizedStatus: "paid" | "failed" | "pending" = "pending";
  const flat = flattenParams(params);
  let emailSent = false;

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
        emailSent={false}
      />
    );
  }

  // Confirm booking + send ticket email via shared processor (no HTTP self-fetch).
  if (normalizedStatus === "paid" || normalizedStatus === "pending") {
    try {
      const result = await processPayFastCallbackParams(flat);
      console.log("[PayFast Success] Fulfillment result:", result.status, result.body);
      emailSent =
        result.ok &&
        (result.body.paymentStatus === "paid" ||
          result.body.message === "Booking already processed");
    } catch (err) {
      console.error("[PayFast Success] Fulfillment error:", err);
    }
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
      emailSent={emailSent && status === "paid"}
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
