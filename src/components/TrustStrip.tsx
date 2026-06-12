import { Crown, Clock, FlaskConical, Repeat } from "lucide-react";
import { EXCHANGE_WINDOW_DAYS } from "@/config/storefront";

const markers = [
  { icon: Crown, text: "Inspired by the world's finest houses" },
  { icon: Clock, text: "Long-lasting 8hr+ wear" },
  { icon: FlaskConical, text: "Crafted, not mass-produced" },
  { icon: Repeat, text: `${EXCHANGE_WINDOW_DAYS}-day exchange promise` },
];

/** Credibility strip under the hero — icons and short claims only, no paragraphs. */
const TrustStrip = () => (
  <div className="border-y border-border bg-obsidian-light/60">
    <div className="container mx-auto px-6 py-5 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
      {markers.map(({ icon: Icon, text }) => (
        <div key={text} className="flex items-center justify-center gap-2.5 text-center sm:text-left">
          <Icon className="w-4 h-4 text-primary shrink-0" />
          <span className="text-muted-foreground text-[11px] sm:text-xs font-sans tracking-wider uppercase">{text}</span>
        </div>
      ))}
    </div>
  </div>
);

export default TrustStrip;
