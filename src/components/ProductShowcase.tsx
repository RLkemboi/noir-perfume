import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useStorefrontProducts } from "@/hooks/useStorefrontProducts";
import { rankProducts } from "@/utils/productRanking";
import { EDITORS_PICKS_LIMIT } from "@/config/storefront";
import { ProductCard } from "./ProductCard";

/**
 * Landing-page section: a deliberately small, curated set. The full
 * catalogue lives on /collection — the landing page never lists everything.
 */
const ProductShowcase = () => {
  const { products, isLoading } = useStorefrontProducts();

  // Popularity with a slight price bias decides who earns a landing-page slot.
  const picks = useMemo(
    () => rankProducts(products, { hasActiveCategory: true }).slice(0, EDITORS_PICKS_LIMIT),
    [products]
  );

  return (
    <section id="products" className="py-32 bg-background relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary/80 text-xs tracking-[0.4em] uppercase mb-4 font-sans font-medium">Editor's Picks</p>
          <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold mb-4">
            Where to <span className="gold-text italic">Begin</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto font-sans leading-relaxed">
            Six fragrances we trust with a first impression. Best for first-timers —
            and for those who already know exactly what they want.
          </p>
        </motion.div>

        {/* Product Grid */}
        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {isLoading ? (
            <div className="col-span-full py-16 text-center text-sm text-muted-foreground">Loading catalogue...</div>
          ) : (
            picks.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-14"
        >
          <Link
            to="/collection"
            className="inline-flex items-center gap-2 px-10 py-4 gold-border text-primary font-sans text-sm tracking-[0.15em] uppercase font-semibold hover:bg-primary/10 transition-colors"
          >
            Explore the Full Collection <ArrowUpRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default ProductShowcase;
