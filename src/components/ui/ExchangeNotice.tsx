import { Repeat } from "lucide-react";
import { EXCHANGE_NOTICE_TEXT } from "@/config/storefront";

/**
 * Honest risk-reduction line for CTAs and pricing. Policy is exchange-only —
 * never word this as a refund or money-back guarantee.
 */
export function ExchangeNotice({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-start gap-2 text-muted-foreground text-xs font-sans leading-relaxed ${className}`}>
      <Repeat className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
      <span>{EXCHANGE_NOTICE_TEXT}</span>
    </p>
  );
}
