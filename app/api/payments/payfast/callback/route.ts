import { NextRequest, NextResponse } from "next/server";
import { processPayFastCallbackParams } from "@/lib/payments/processPayFastCallback";

/**
 * PayFast IPN / server-to-server callback.
 * Browser redirects also land on /checkout/success which calls the same processor.
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let params: Record<string, string> = {};

    if (contentType.includes("application/json")) {
      const body = await request.json();
      params = Object.fromEntries(
        Object.entries(body).map(([k, v]) => [k, String(v ?? "")]),
      );
    } else {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        params[key] = value.toString();
      });
    }

    const result = await processPayFastCallbackParams(params);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("[PayFast Webhook] Unexpected error parsing request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const result = await processPayFastCallbackParams(params);
  return NextResponse.json(result.body, { status: result.status });
}
