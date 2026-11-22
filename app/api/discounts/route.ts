import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { loadDiscountDetail, loadDiscounts } from "@/lib/discounts/catalog";
import { parseDiscountView, type DiscountTier } from "@/lib/discounts/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/discounts
 *
 * The /discounts page's data after a filter, tab or card change: the three
 * sections, filter menus and wallet counts (see lib/discounts/catalog).
 * Takes the page's query (`tab`, `card`, `tier`, `q`, `bank`, `category`,
 * `area`) plus:
 * - `page` and `more` (a section to page without opening it), or
 * - `detail` (one place's key): returns `{ item }` with its offers and
 *   branches for the deal sheet.
 * Saved cards come from the session cookie, so the response is private.
 */
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const view = parseDiscountView(params);
  const page = /^\d+$/.test(params.page ?? "") ? Math.min(Number(params.page), 500) : 1;
  const more = (["half", "forty", "rest"] as DiscountTier[]).find((t) => t === params.more) ?? null;
  const detail = params.detail?.trim().slice(0, 200) || null;
  const headers = { "Cache-Control": "private, no-store" };

  try {
    const session = await getSession(request);
    const userId = session?.userId ?? null;
    if (detail) {
      const item = await loadDiscountDetail(view, detail, { userId });
      if (!item) return NextResponse.json({ error: "not_found" }, { status: 404, headers });
      return NextResponse.json({ item }, { headers });
    }
    const data = await loadDiscounts(view, { userId, page, pageTier: more });
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error("[discounts] load failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Discounts didn't load. Try again." }, { status: 500, headers });
  }
}
