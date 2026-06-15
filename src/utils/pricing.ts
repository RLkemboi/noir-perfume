import { DAYS_OF_WEAR } from "@/config/storefront";
import { parsePrice } from "./productRanking";

export { parsePrice };

export function formatMoney(value: number): string {
  return `KES ${Math.round(value).toLocaleString()}`;
}

/** Framing line shown beside prices: the cost of a Signature bottle spread over daily wear. */
export function perDayLine(price: string | number): string {
  const value = typeof price === "number" ? price : parsePrice(price);
  if (value <= 0) return "";
  const perDay = Math.round(value / DAYS_OF_WEAR);
  return `About KES ${perDay.toLocaleString()} per day over ${Math.round(DAYS_OF_WEAR / 30)} months of wear`;
}
