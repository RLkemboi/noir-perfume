import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
import { BadgeCheck, ArrowUpRight, Heart } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { ExchangeNotice } from "@/components/ui/ExchangeNotice";
import { useStorefrontProducts } from "@/hooks/useStorefrontProducts";
import { useWishlist } from "@/hooks/useWishlist";
import { rankProducts } from "@/utils/productRanking";
import { SCENT_FAMILIES, SIGNATURE_VIEW_LIMIT } from "@/config/storefront";
import { useSEO } from "@/hooks/useSEO";
import type { StorefrontProduct } from "@/utils/storefrontProductAdapter";

type ViewKey = "signature" | "all" | "shortlist" | StorefrontProduct["tags"]["element"];

const FAMILY_KEYS = new Set(SCENT_FAMILIES.map((f) => f.key as string));

/**
 * Serial-position ordering for a section: strongest first, second-strongest
 * closes the section instead of drowning mid-grid.
 */
function orderForSection(items: StorefrontProduct[]): StorefrontProduct[] {
  const ranked = rankProducts(items, { hasActiveCategory: true });
  if (ranked.length < 4) return ranked;
  const [first, second, ...rest] = ranked;
  return [first, ...rest, second];
}

const Catalogue = () => {
  const { products, isLoading } = useStorefrontProducts();
  const { ids: wishlistIds, count: wishlistCount } = useWishlist();
  const [searchParams, setSearchParams] = useSearchParams();

  const paramView = searchParams.get("family");
  const initialView: ViewKey = paramView && FAMILY_KEYS.has(paramView) ? (paramView as ViewKey) : "signature";
  const [view, setView] = useState<ViewKey>(initialView);

  useSEO({
    title: "The Collection — NOIR Perfume | Every Fragrance We Pour",
    description:
      "Browse NOIR's full collection of luxury fragrances by scent family — oud, amber, fresh and floral. Hand-poured in small batches in Nairobi.",
    url: "/collection",
  });

  const selectView = (next: ViewKey) => {
    setView(next);
    setSearchParams(FAMILY_KEYS.has(next) ? { family: next } : {}, { replace: true });
  };

  const visible = useMemo(() => {
    if (view === "signature") {
      return rankProducts(products, { hasActiveCategory: true }).slice(0, SIGNATURE_VIEW_LIMIT);
    }
    if (view === "all") {
      return orderForSection(products);
    }
    if (view === "shortlist") {
      return orderForSection(products.filter((p) => wishlistIds.includes(p.id)));
    }
    return orderForSection(products.filter((p) => p.tags.element === view));
  }, [products, view, wishlistIds]);

  const activeFamily = SCENT_FAMILIES.find((f) => f.key === view);

  const filterChip = (key: ViewKey, label: React.ReactNode, active: boolean) => (
    <button
      key={String(key)}
      onClick={() => selectView(key)}
      className={`px-4 py-2 text-[11px] tracking-[0.15em] uppercase font-sans font-semibold rounded-full border transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="pt-28 pb-24">
        <div className="container mx-auto px-6">
          {/* Heading + quality standard (Halo — once, not per card) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <p className="text-primary/80 text-xs tracking-[0.4em] uppercase mb-4 font-sans font-medium">The Collection</p>
            <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold mb-4">
              Every Bottle We <span className="gold-text italic">Stand Behind</span>
            </h1>
            <p className="flex items-center justify-center gap-2 text-muted-foreground text-xs font-sans tracking-wider uppercase">
              <BadgeCheck className="w-4 h-4 text-primary" />
              The NOIR Quality Standard — hand-poured, batch-tested, 8hr+ wear
            </p>
          </motion.div>

          {/* Filters */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mb-4">
            {filterChip("signature", "Signature Collection", view === "signature")}
            {SCENT_FAMILIES.map((family) =>
              filterChip(
                family.key,
                <>
                  {family.title} <span className="opacity-60 normal-case tracking-normal">· {family.technical}</span>
                </>,
                view === family.key
              )
            )}
            {wishlistCount > 0 &&
              filterChip(
                "shortlist",
                <span className="inline-flex items-center gap-1.5">
                  <Heart className="w-3 h-3" /> My Shortlist ({wishlistCount})
                </span>,
                view === "shortlist"
              )}
            {filterChip("all", `View All ${products.length} Scents`, view === "all")}
          </div>

          {/* Active section framing */}
          <div className="text-center mb-12">
            {view === "signature" && (
              <p className="text-muted-foreground text-sm font-sans">
                Our most chosen fragrances — the right place to start. Narrow by scent family, or see everything.
              </p>
            )}
            {activeFamily && (
              <p className="text-muted-foreground text-sm font-sans">
                {activeFamily.title} — the {activeFamily.technical.toLowerCase()} family.
              </p>
            )}
            {view === "shortlist" && (
              <p className="text-muted-foreground text-sm font-sans">
                Your shortlist, saved on this device. Take your time.
              </p>
            )}
          </div>

          {/* Grid */}
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {isLoading ? (
              <div className="col-span-full py-16 text-center text-sm text-muted-foreground">Loading catalogue...</div>
            ) : (
              <AnimatePresence mode="popLayout">
                {visible.map((product, i) => (
                  <ProductCard key={product.id} product={product} index={i} />
                ))}
              </AnimatePresence>
            )}
          </motion.div>

          {!isLoading && visible.length === 0 && (
            <div className="text-center py-20">
              <p className="text-muted-foreground font-serif italic text-xl">
                {view === "shortlist" ? "Your shortlist is empty — tap the heart on any scent." : "No fragrances match this view."}
              </p>
              <button
                onClick={() => selectView("signature")}
                className="mt-4 text-primary text-sm tracking-widest uppercase font-bold hover:underline"
              >
                Back to Signature Collection
              </button>
            </div>
          )}

          {/* Closing module (Recency) — never end on a bare grid */}
          {!isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass-panel max-w-3xl mx-auto mt-24 p-10 sm:p-14 text-center gold-glow"
            >
              <h2 className="font-serif text-3xl font-bold mb-3">
                New to <span className="gold-text italic">NOIR</span>?
              </h2>
              <p className="text-muted-foreground font-sans text-sm leading-relaxed max-w-md mx-auto mb-8">
                Ninety scents is a lot of decisions. Answer three questions and we'll
                match you with the one that fits how you move through a room.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                <Link
                  to="/#scent-finder"
                  className="px-8 py-3.5 bg-primary text-primary-foreground font-sans text-xs tracking-[0.15em] uppercase font-semibold hover:bg-gold-light transition-colors"
                >
                  Find Your Signature
                </Link>
                <button
                  onClick={() => {
                    selectView("signature");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="inline-flex items-center gap-2 px-8 py-3.5 gold-border text-primary font-sans text-xs tracking-[0.15em] uppercase font-semibold hover:bg-primary/10 transition-colors"
                >
                  Start with Our Picks <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <ExchangeNotice className="justify-center" />
            </motion.div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Catalogue;
