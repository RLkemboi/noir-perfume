import { Sparkles } from "lucide-react";

/**
 * "Scent of the Week" badge — same visual language on the landing page,
 * catalogue cards, and product detail (mere-exposure repetition).
 */
export function FeaturedBadge({ label = "Scent of the Week" }: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary text-primary-foreground text-[10px] tracking-widest uppercase font-bold rounded-full luxury-shadow">
      <Sparkles className="w-3 h-3" /> {label}
    </div>
  );
}
