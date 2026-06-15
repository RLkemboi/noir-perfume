import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useStorefrontProducts } from "@/hooks/useStorefrontProducts";
import { SIZE_TIERS, tierPrice } from "@/data/sizeTiers";
import { parsePrice, formatMoney, perDayLine } from "@/utils/pricing";
import { ExchangeNotice } from "@/components/ui/ExchangeNotice";

/**
 * Three formats, rendered Collector's-first so the largest price anchors the
 * read; Signature is the visually recommended middle choice.
 */
const PricingTiers = () => {
  const { products } = useStorefrontProducts();

  // "From" price per tier, derived from the least expensive scent in the catalogue.
  const cheapest = useMemo(
    () => (products.length > 0 ? Math.min(...products.map((p) => parsePrice(p.price))) : 0),
    [products]
  );

  if (cheapest <= 0) return null;

  return (
    <section id="formats" className="py-32 bg-obsidian-light relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-primary/3 blur-[200px]" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-6"
        >
          <p className="text-primary/80 text-xs tracking-[0.4em] uppercase mb-4 font-sans font-medium">The Formats</p>
          <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold mb-4">
            Choose Your <span className="gold-text italic">Commitment</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto font-sans leading-relaxed">
            Where comparable luxury fragrances retail for KES 39,000 and beyond, NOIR offers the
            same obsessive craft in three formats — hand-poured in Nairobi.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-14">
          {SIZE_TIERS.map((tier, i) => {
            const from = tierPrice(cheapest, tier);
            return (
              <motion.div
                key={tier.key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`glass-panel p-8 flex flex-col text-center relative ${
                  tier.recommended ? "border-primary/40 gold-glow md:scale-105" : ""
                }`}
              >
                {tier.recommended && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-[10px] tracking-widest uppercase font-bold rounded-full luxury-shadow">
                    Most Chosen
                  </span>
                )}
                <p className="text-primary/70 text-[10px] tracking-[0.25em] uppercase font-sans font-semibold mb-2">{tier.size}</p>
                <h3 className="font-serif text-2xl font-bold mb-1">{tier.label}</h3>
                <p className="text-muted-foreground text-xs font-sans leading-relaxed mb-6">{tier.tagline}</p>
                <div className="mt-auto space-y-1">
                  <p className="font-serif text-3xl gold-text font-bold">
                    from {formatMoney(from)}
                  </p>
                  {tier.recommended && (
                    <p className="text-muted-foreground text-[10px] font-sans">{perDayLine(from)}</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="max-w-xl mx-auto mt-12 text-center space-y-6">
          <ExchangeNotice className="justify-center text-center" />
          <Link
            to="/collection"
            className="inline-flex items-center gap-2 px-10 py-4 bg-primary text-primary-foreground font-sans text-sm tracking-[0.15em] uppercase font-semibold hover:bg-gold-light transition-colors gold-glow"
          >
            Browse the Collection <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default PricingTiers;
