import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Tag, Clock, ShieldCheck } from "lucide-react";
import { products } from "@/data";
import { formatMoney } from "@/utils/pricing";
import { parsePrice } from "@/utils/productRanking";
import { rankProducts } from "@/utils/productRanking";
import { useSEO } from "@/hooks/useSEO";
import { useCart } from "@/context/CartContext";
import { DEFAULT_TIER } from "@/data/sizeTiers";
import { toast } from "sonner";

export default function Deals() {
  const { addItem } = useCart();

  useSEO({
    title: "Deals — Noir Fragrance",
    description: "Exclusive limited-time deals on luxury fragrance copies. Save on our most popular scents.",
    url: "/deals",
  });

  const dealsProducts = rankProducts(
    products.filter((p) => p.onDeal && p.dealPreviousPrice != null),
    { hasActiveCategory: true }
  );

  const handleQuickAdd = (p: (typeof products)[0]) => {
    const copyPrice = p.copyPrice ?? parsePrice(p.price);
    addItem({
      productId: p.id,
      name: p.name,
      brand: p.brand,
      price: formatMoney(copyPrice),
      image: p.image,
      size: DEFAULT_TIER.size,
      variant: "copy",
      variantLabel: `Our version of ${p.name}`,
    });
    toast.success(`${p.name} added to bag`, {
      icon: <ShieldCheck className="w-4 h-4 text-primary" />,
      className: "glass-panel border-primary/20",
    });
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-4">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Hero */}
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 border border-primary/30 rounded-full mb-4">
              <Tag className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] tracking-[0.2em] uppercase font-bold text-primary">Limited Time</span>
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl font-bold mb-4">
              Noir <span className="gold-text italic">Deals</span>
            </h1>
            <p className="text-muted-foreground font-sans max-w-xl mx-auto">
              Handpicked offers on our quality fragrance copies — at prices that make luxury accessible.
            </p>
          </div>

          {dealsProducts.length === 0 ? (
            <div className="glass-panel p-16 text-center space-y-4">
              <Tag className="w-10 h-10 text-muted-foreground mx-auto" />
              <p className="font-serif text-xl italic text-muted-foreground">No active deals right now.</p>
              <p className="text-sm text-muted-foreground font-sans">Check back soon — we rotate deals weekly.</p>
              <Link
                to="/collection"
                className="inline-block mt-2 px-6 py-3 bg-primary text-primary-foreground text-xs tracking-widest uppercase font-bold hover:bg-gold-light transition-colors"
              >
                Browse Full Collection
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {dealsProducts.map((p, i) => {
                const copyPrice = p.copyPrice ?? parsePrice(p.price);
                const wasPrice = p.dealPreviousPrice!;
                const savedPct = Math.round(((wasPrice - copyPrice) / wasPrice) * 100);

                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.07 }}
                    className="glass-panel overflow-hidden group"
                  >
                    {/* Image */}
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <Link to={`/product/${p.id}`}>
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
                      </Link>
                      {/* Savings badge */}
                      <div className="absolute top-4 left-4 px-3 py-1 bg-primary text-primary-foreground text-[10px] tracking-widest uppercase font-bold rounded-full luxury-shadow">
                        Save {savedPct}%
                      </div>
                      {/* Ships fast badge */}
                      <div className="absolute bottom-4 left-4 flex items-center gap-1.5 px-2 py-1 bg-background/90 text-[10px] font-sans uppercase tracking-widest text-muted-foreground rounded">
                        <Clock className="w-3 h-3 text-primary" /> Ships 2–3 days
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-5 space-y-3">
                      <div>
                        <p className="text-primary/60 text-[10px] font-sans tracking-[0.2em] uppercase font-semibold">{p.brand}</p>
                        <Link to={`/product/${p.id}`}>
                          <h3 className="font-serif text-lg font-bold group-hover:text-primary transition-colors leading-tight">
                            Our version of {p.name}
                          </h3>
                        </Link>
                        <p className="text-muted-foreground text-xs font-sans mt-0.5 italic">{p.subtitle}</p>
                      </div>

                      {/* Pricing */}
                      <div className="flex items-baseline gap-3">
                        <span className="font-serif text-xl gold-text font-bold">{formatMoney(copyPrice)}</span>
                        <span className="text-sm text-muted-foreground line-through">{formatMoney(wasPrice)}</span>
                      </div>

                      {/* Muted original price context */}
                      <p className="text-[11px] text-muted-foreground/70 font-sans italic">
                        Original retail: <span className="line-through">{formatMoney(p.originalRetailKes ?? parsePrice(p.price))}</span>
                        {p.scentAccuracyPct ? ` · ~${p.scentAccuracyPct}% scent match` : ""}
                      </p>

                      {/* CTA */}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleQuickAdd(p)}
                          className="flex-1 py-2.5 bg-primary text-primary-foreground text-[10px] tracking-widest uppercase font-bold hover:bg-gold-light transition-colors luxury-shadow"
                        >
                          Add to Bag
                        </button>
                        <Link
                          to={`/product/${p.id}`}
                          className="px-4 py-2.5 border border-border text-[10px] tracking-widest uppercase font-bold text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                        >
                          Details
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Assurance strip */}
          <div className="mt-16 glass-panel p-6 flex flex-wrap justify-center gap-8">
            {["Authentic Oils", "No Fake Brand Claims", "Fast Delivery", "First Swap Free"].map((b) => (
              <span key={b} className="flex items-center gap-2 text-muted-foreground text-xs font-sans">
                <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" /> {b}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
