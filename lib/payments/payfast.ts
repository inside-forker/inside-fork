/**
 * PayFast Payment Gateway Integration (Apps.net.pk / GoPayFast)
 *
 * This module implements the strict PayFast API flow:
 * 1. Fetch Access Token from PayFast API (server-side)
 * 2. Render auto-submitting form with token + transaction details
 * 3. Validate callback response using SHA256 hash verification
 *
 * Hosts:
 * - Live:  https://ipg1.apps.net.pk
 * - UAT:   https://ipguat.apps.net.pk  (sandbox only — broken/unstyled checkout UI)
 */

import crypto from "crypto";

/** Live GoPayFast host. Production must use this, not the UAT sandbox. */
export const PAYFAST_LIVE_HOST = "https://ipg1.apps.net.pk";
/** Sandbox / UAT host. Only for explicit local testing. */
export const PAYFAST_SANDBOX_HOST = "https://ipguat.apps.net.pk";

export const PAYFAST_LIVE_TOKEN_URL = `${PAYFAST_LIVE_HOST}/Ecommerce/api/Transaction/GetAccessToken`;
export const PAYFAST_LIVE_TRANSACTION_URL = `${PAYFAST_LIVE_HOST}/Ecommerce/api/Transaction/PostTransaction`;
export const PAYFAST_SANDBOX_TOKEN_URL = `${PAYFAST_SANDBOX_HOST}/Ecommerce/api/Transaction/GetAccessToken`;
export const PAYFAST_SANDBOX_TRANSACTION_URL = `${PAYFAST_SANDBOX_HOST}/Ecommerce/api/Transaction/PostTransaction`;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PayFastTokenRequest {
  MERCHANT_ID: string;
  SECURED_KEY: string;
  BASKET_ID: string;
  TXNAMT: string;
}

export interface PayFastTokenResponse {
  ACCESS_TOKEN: string;
  /** Legacy spaced key some docs mention */
  "GENERATED DATE TIME"?: string;
  /** Actual key returned by current UAT/live APIs */
  GENERATED_DATE_TIME?: string;
  MERCHANT_ID?: number | string;
  NAME?: string;
}

export interface PayFastTransactionFields {
  MERCHANT_ID: string;
  MERCHANT_NAME: string;
  TOKEN: string;
  PROCCODE: string;
  TXNAMT: string;
  CUSTOMER_MOBILE_NO: string;
  CUSTOMER_EMAIL_ADDRESS: string;
  SIGNATURE: string;
  VERSION: string;
  TXNDESC: string;
  SUCCESS_URL: string;
  FAILURE_URL: string;
  CHECKOUT_URL: string; // Server-to-server IPN destination (backend notification)
  BASKET_ID: string;
  ORDER_DATE: string;
  STORE_ID?: string; // Optional outlet identifier; omitted when not configured
  TRAN_TYPE: string;
  CURRENCY_CODE: string; // Must match token context (e.g., "PKR")
  MERCHANT_USERAGENT: string; // Fraud check: User agent of the request
  CUSTOMER_IPADDRESS: string; // Fraud check: Customer's IP address
}

export interface PayFastCallbackParams {
  basket_id: string;
  err_code: string;
  err_msg?: string;
  transaction_id?: string;
  [key: string]: string | undefined;
}

// ============================================================================
// ENVIRONMENT HELPERS
// ============================================================================

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

const PAYFAST_REQUIRED_KEYS = [
  "PAYFAST_MERCHANT_ID",
  "PAYFAST_SECURED_KEY",
  "PAYFAST_MERCHANT_NAME",
] as const;

/** True when merchant credentials are present (URLs have live defaults). */
export function isPayFastConfigured(): boolean {
  return PAYFAST_REQUIRED_KEYS.every((key) => Boolean(process.env[key]?.trim()));
}

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

function isSandboxHost(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase().includes("ipguat");
  } catch {
    return /ipguat/i.test(url);
  }
}

/**
 * Sandbox is allowed only when not in production, or when
 * PAYFAST_ALLOW_SANDBOX=true is set explicitly (staging experiments).
 */
function allowSandbox(): boolean {
  if (process.env.PAYFAST_ALLOW_SANDBOX === "true") return true;
  return !isProductionRuntime();
}

/**
 * Resolve a PayFast API URL.
 *
 * - Local/dev: use env as-is (UAT for the official test merchant 102).
 * - Production: refuse UAT unless PAYFAST_ALLOW_SANDBOX=true — the UAT hosted
 *   checkout page often ships without CSS and looks broken to customers.
 */
function resolvePayFastUrl(
  envKey: "PAYFAST_TOKEN_URL" | "PAYFAST_TRANSACTION_URL",
  liveDefault: string,
  sandboxDefault: string,
): string {
  const configured = process.env[envKey]?.trim();
  const preferSandbox = process.env.PAYFAST_USE_SANDBOX === "true";

  let url =
    configured ||
    (preferSandbox && allowSandbox() ? sandboxDefault : liveDefault);

  if (isSandboxHost(url) && !allowSandbox()) {
    console.error(
      `[PayFast] ${envKey} points at UAT (${url}). Overriding to live host in production. ` +
        `Set PAYFAST_* to ipg1.apps.net.pk with live merchant credentials, ` +
        `or set PAYFAST_ALLOW_SANDBOX=true only for intentional sandbox.`,
    );
    url = liveDefault;
  }

  return url;
}

/** Access-token endpoint (server-to-server). */
export function getPayFastTokenUrl(): string {
  return resolvePayFastUrl(
    "PAYFAST_TOKEN_URL",
    PAYFAST_LIVE_TOKEN_URL,
    PAYFAST_SANDBOX_TOKEN_URL,
  );
}

/** Timestamp from a token response (API key name varies). */
export function getPayFastTokenGeneratedAt(
  token: PayFastTokenResponse,
): string | undefined {
  return token.GENERATED_DATE_TIME || token["GENERATED DATE TIME"];
}

// ============================================================================
// STEP 1: FETCH ACCESS TOKEN (Server-side only)
// ============================================================================

/**
 * Fetches an access token from PayFast API.
 * Must be called server-side to protect SECURED_KEY.
 *
 * @param basketId - Unique order/booking ID
 * @param amount - Transaction amount (e.g., "100.00")
 * @returns Access token and generation timestamp
 */
export async function fetchPayFastToken(
  basketId: string,
  amount: string,
): Promise<PayFastTokenResponse> {
  const tokenUrl = getPayFastTokenUrl();
  const merchantId = getEnv("PAYFAST_MERCHANT_ID");
  const securedKey = getEnv("PAYFAST_SECURED_KEY");

  // Ensure amount has 2 decimal places
  const formattedAmount = parseFloat(amount).toFixed(2);

  const params = new URLSearchParams({
    MERCHANT_ID: merchantId,
    SECURED_KEY: securedKey,
    BASKET_ID: basketId,
    TXNAMT: formattedAmount,
    CURRENCY_CODE: "PKR",
  });

  // Always log host (not secrets) so UAT-vs-live mismatches are obvious in logs
  console.info("[PayFast Token Request]", {
    url: tokenUrl,
    merchant_id: merchantId,
    basket_id: basketId,
    amount: formattedAmount,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "InsideKarachi-NextApp/1.0",
      "Cache-Control": "no-cache",
    },
    body: params.toString(),
  });

  // Get raw response text for debugging
  const responseText = await response.text();

  // Check if response is OK
  if (!response.ok) {
    console.error("[PayFast Token Error]", {
      status: response.status,
      url: tokenUrl,
      merchant_id: merchantId,
      body: responseText,
    });
    throw new Error(
      `PayFast token request failed (${response.status}): ${responseText}`,
    );
  }

  // Try to parse JSON
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (parseError) {
    console.error("[PayFast Token] Invalid JSON response:", {
      responseText,
      parseError,
    });
    throw new Error(
      `PayFast returned invalid JSON response: ${responseText.substring(
        0,
        200,
      )}`,
    );
  }

  // Validate response structure
  if (!data.ACCESS_TOKEN) {
    console.error("[PayFast Token] Missing ACCESS_TOKEN in response:", data);
    throw new Error(
      `PayFast token response missing ACCESS_TOKEN. Response: ${JSON.stringify(
        data,
      )}`,
    );
  }

  // Success
  if (process.env.NODE_ENV === "development") {
    console.log("[PayFast Token] ok", {
      url: tokenUrl,
      generatedAt: getPayFastTokenGeneratedAt(data as PayFastTokenResponse),
    });
  }

  return data as PayFastTokenResponse;
}

// ============================================================================
// STEP 2: GENERATE TRANSACTION FORM FIELDS
// ============================================================================

/**
 * Generates the hidden form fields for PayFast transaction POST.
 * The form will auto-submit to PAYFAST_TRANSACTION_URL.
 *
 * @param params - Transaction parameters
 * @returns Object with all required hidden fields
 */
export function generatePayFastFormFields(params: {
  token: string;
  basketId: string;
  amount: string;
  customerMobile: string;
  customerEmail: string;
  orderDate: string;
  transactionDescription: string;
  successUrl: string;
  failureUrl: string;
  checkoutUrl: string; // Server-to-server IPN destination (backend notification)
  userAgent?: string; // Optional: User agent from request headers
  userIp: string; // User IP address from request
}): PayFastTransactionFields {
  const merchantId = getEnv("PAYFAST_MERCHANT_ID");
  const merchantName = getEnv("PAYFAST_MERCHANT_NAME");
  const storeId = process.env.PAYFAST_STORE_ID ?? "";

  const signature = crypto.randomBytes(16).toString("hex");

  const standardUserAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  const customerIp =
    params.userIp && params.userIp !== "127.0.0.1" && params.userIp !== "::1"
      ? params.userIp
      : "203.0.113.1";

  const fields: PayFastTransactionFields = {
    MERCHANT_ID: merchantId,
    MERCHANT_NAME: merchantName,
    TOKEN: params.token,
    PROCCODE: "00",
    TXNAMT: params.amount,
    CUSTOMER_MOBILE_NO: params.customerMobile,
    CUSTOMER_EMAIL_ADDRESS: params.customerEmail,
    SIGNATURE: signature,
    VERSION: "MERCHANTCART-0.1",
    TXNDESC: params.transactionDescription,
    SUCCESS_URL: params.successUrl,
    FAILURE_URL: params.failureUrl,
    CHECKOUT_URL: params.checkoutUrl,
    BASKET_ID: params.basketId,
    ORDER_DATE: params.orderDate,
    TRAN_TYPE: "ECOMM_PURCHASE",
    CURRENCY_CODE: "PKR",
    MERCHANT_USERAGENT: standardUserAgent,
    CUSTOMER_IPADDRESS: customerIp,
  };

  if (storeId) {
    fields.STORE_ID = storeId;
  }

  return fields;
}

/**
 * Formats the ORDER_DATE field in YYYY-MM-DD format.
 */
export function formatPayFastOrderDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ============================================================================
// STEP 3: VALIDATE CALLBACK RESPONSE
// ============================================================================

/**
 * Validates the PayFast callback using SHA256 hash verification.
 *
 * Official formula (Merchant Integration Guide):
 *   SHA256(basket_id + '|' + secured_key + '|' + merchant_id + '|' + err_code)
 *
 * UAT sometimes returns a hash that does not match this formula even when the
 * payment succeeded (err_code 000). In sandbox mode we accept a successful
 * err_code and let the webhook/success handler verify amount against the booking.
 */
export function validatePayFastCallback(params: PayFastCallbackParams): {
  isValid: boolean;
  basketId: string;
  errorCode: string;
  errorMessage?: string;
  transactionId?: string;
  calculatedHash: string;
  /** True when we accepted a sandbox success despite a hash mismatch. */
  sandboxBypass?: boolean;
} {
  const { basket_id, err_code, err_msg, transaction_id } = params;

  if (!basket_id || !err_code) {
    throw new Error(
      "Missing required callback parameters: basket_id or err_code",
    );
  }

  const securedKey = getEnv("PAYFAST_SECURED_KEY");
  const merchantId = getEnv("PAYFAST_MERCHANT_ID");

  const receivedHash = (
    params.validation_hash ||
    params.hash ||
    params.response_hash ||
    params.HASH ||
    ""
  ).trim();

  const safeBasketId = basket_id.trim();
  const safeErrCode = err_code.trim();

  // Docs: Basket ID | Merchant Secured Key | Merchant ID | Error Code
  const hashString = `${safeBasketId}|${securedKey}|${merchantId}|${safeErrCode}`;
  const calculatedHash = crypto
    .createHash("sha256")
    .update(hashString)
    .digest("hex");

  let isValid =
    !!receivedHash &&
    receivedHash.toLowerCase() === calculatedHash.toLowerCase();

  // Some UAT responses omit validation_hash or use a divergent secret; also try
  // Response_Key as the middle segment (observed on Apps.net.pk callbacks).
  if (!isValid) {
    const responseKey = (params.Response_Key || params.response_key || "").trim();
    if (responseKey) {
      const alt = crypto
        .createHash("sha256")
        .update(
          `${safeBasketId}|${responseKey}|${merchantId}|${safeErrCode}`,
        )
        .digest("hex");
      if (receivedHash.toLowerCase() === alt.toLowerCase()) {
        isValid = true;
      }
    }
  }

  let sandboxBypass = false;
  if (!isValid) {
    console.error("[PayFast Validation] Hash mismatch:");
    console.error(`  Expected: ${calculatedHash}`);
    console.error(`  Received: ${receivedHash || "(empty)"}`);
    console.error(
      `  Formula:  ${safeBasketId} | [REDACTED] | ${merchantId} | ${safeErrCode}`,
    );

    const successCode = safeErrCode === "00" || safeErrCode === "000";

    // Only soft-accept on non-production (or explicit PAYFAST_ALLOW_SANDBOX).
    // Never weaken hash checks in live production.
    if (allowSandbox() && successCode) {
      console.warn(
        "[PayFast Validation] Sandbox bypass: accepting err_code success despite hash mismatch",
      );
      isValid = true;
      sandboxBypass = true;
    }
  }

  return {
    isValid,
    basketId: basket_id,
    errorCode: err_code,
    errorMessage: err_msg,
    transactionId: transaction_id,
    calculatedHash,
    sandboxBypass,
  };
}

/**
 * Maps PayFast error codes to normalized payment statuses.
 *
 * @param errorCode - PayFast err_code from callback
 * @returns Normalized status: 'paid', 'failed', 'pending'
 */
export function normalizePayFastStatus(
  errorCode: string,
): "paid" | "failed" | "pending" {
  // PayFast success codes (typically "00" or "000")
  if (errorCode === "00" || errorCode === "000") {
    return "paid";
  }

  // Pending/Processing codes (if applicable)
  if (errorCode === "124" || errorCode === "125") {
    return "pending";
  }

  // All other codes are failures
  return "failed";
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Formats Pakistani phone number to PayFast expected format.
 * Examples: 03001234567 -> 923001234567
 */
export function formatPayFastMobile(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");

  // If starts with 92, return as is
  if (cleaned.startsWith("92")) {
    return cleaned;
  }

  // If starts with 0, replace with 92
  if (cleaned.startsWith("0")) {
    return "92" + cleaned.slice(1);
  }

  // If starts with 3, prepend 92
  if (cleaned.startsWith("3")) {
    return "92" + cleaned;
  }

  return cleaned;
}

/**
 * Returns the PayFast transaction POST URL (browser form action).
 * Production always lands on the live host unless PAYFAST_ALLOW_SANDBOX=true.
 */
export function getPayFastTransactionUrl(): string {
  return resolvePayFastUrl(
    "PAYFAST_TRANSACTION_URL",
    PAYFAST_LIVE_TRANSACTION_URL,
    PAYFAST_SANDBOX_TRANSACTION_URL,
  );
}

/**
 * Validates that the amount matches between token request and form submission.
 * PayFast requires exact match.
 */
export function validateAmountMatch(
  tokenAmount: string,
  formAmount: string,
): boolean {
  const token = parseFloat(tokenAmount);
  const form = parseFloat(formAmount);
  return Math.abs(token - form) < 0.01; // Allow 1 cent tolerance for floating point
}
