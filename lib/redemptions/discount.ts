/** Estimate discount PKR from deal.discount_value text + bill. */
export function estimateDiscountValue(
  billValue: number,
  dealDiscountRaw: string | null | undefined,
): number | null {
  if (!Number.isFinite(billValue) || billValue <= 0) return null;
  const raw = (dealDiscountRaw ?? "").trim();
  const pct = raw.match(/(\d+)\s*%/);
  if (pct) {
    const percent = Math.min(100, parseInt(pct[1]!, 10));
    return Math.round(((billValue * percent) / 100) * 100) / 100;
  }
  const flat = raw.match(/(?:rs\.?|pkr)\s*([\d,]+)/i);
  if (flat) {
    const amount = parseFloat(flat[1]!.replace(/,/g, ""));
    if (Number.isFinite(amount) && amount > 0) {
      return Math.min(billValue, Math.round(amount * 100) / 100);
    }
  }
  return null;
}
