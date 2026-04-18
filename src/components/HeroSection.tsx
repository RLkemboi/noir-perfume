import { motion } from "framer-motion";

const HeroSection = () => {
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
          src="/assets/hero-perfume.jpg"
          alt="Luxury perfume with raw ingredients"
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
            Forged for those who built themselves
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
          className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto mb-10 font-sans font-light leading-relaxed"
        >
          Rare ingredients. Obsessive craftsmanship. Scents engineered for people 
          who refuse to be average.
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
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-muted-foreground text-[10px] tracking-[0.3em] uppercase font-sans">Scroll</span>
        <div className="w-px h-8 bg-gradient-to-b from-primary/60 to-transparent" />
      </motion.div>
    </section>
  );
};

export default HeroSection;
