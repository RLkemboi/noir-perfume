import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Flame, ArrowUpRight } from "lucide-react";
import { FeaturedBadge } from "@/components/ui/FeaturedBadge";
import { BATCH_NOTE, CRAFTSMANSHIP_LINE, SCENT_OF_THE_WEEK_ID } from "@/config/storefront";
import { useStorefrontProducts } from "@/hooks/useStorefrontProducts";

const HeroSection = () => {
  const { products } = useStorefrontProducts();
  const featured = products.find((p) => p.id === SCENT_OF_THE_WEEK_ID);
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] animate-fluid" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-gold-dark/10 blur-[100px] animate-fluid" style={{ animationDelay: "-5s" }} />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] rounded-full bg-primary/3 blur-[80px] animate-pulse-gold" />
      </div>

      {/* Hero image */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.img
          src="/assets/ysl-tuxedo.jpg"
          alt="Yves Saint Laurent Tuxedo flacon against black silk and raw spices"
          className="w-full h-full object-cover opacity-40"
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 2, ease: "easeOut" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/30" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
        >
          <p className="text-primary/80 text-xs sm:text-sm tracking-[0.4em] uppercase mb-6 font-sans font-medium">
            For those who notice what others overlook
          </p>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[0.95] mb-8 tracking-tight"
        >
          <span className="text-foreground">You Didn't Come</span>
          <br />
          <span className="text-foreground">This Far to Smell</span>
          <br />
          <span className="gold-text italic">Ordinary.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto mb-4 font-sans font-light leading-relaxed"
        >
          Rare ingredients. Obsessive craftsmanship. Scents engineered for people
          who refuse to be average.
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.9 }}
          className="text-primary/70 text-[11px] tracking-[0.25em] uppercase mb-10 font-sans"
        >
          {CRAFTSMANSHIP_LINE}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.1 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href="#products"
            className="px-10 py-4 bg-primary text-primary-foreground font-sans text-sm tracking-[0.15em] uppercase font-semibold hover:bg-gold-light transition-colors gold-glow"
          >
            Explore the Collection
          </a>
          <a
            href="#scent-finder"
            className="px-10 py-4 gold-border text-primary font-sans text-sm tracking-[0.15em] uppercase font-semibold hover:bg-primary/10 transition-colors"
          >
            Find Your Scent
          </a>
        </motion.div>

        {/* Featured scent chip + honest batch note */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.4 }}
          className="mt-12 flex flex-col items-center gap-3"
        >
          {featured && (
            <Link
              to={`/product/${featured.id}`}
              className="group inline-flex items-center gap-3 glass-panel px-5 py-2.5 rounded-full hover:border-primary/40 transition-colors"
            >
              <FeaturedBadge />
              <span className="text-foreground/80 text-xs font-sans tracking-wider">
                {featured.name} — {featured.brand}
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-primary opacity-60 group-hover:opacity-100 transition-opacity" />
            </Link>
          )}
          <p className="flex items-center gap-1.5 text-muted-foreground text-[10px] tracking-[0.2em] uppercase font-sans">
            <Flame className="w-3 h-3 text-primary" /> {BATCH_NOTE}
          </p>
        </motion.div>
      </div>

    </section>
  );
};

export default HeroSection;
