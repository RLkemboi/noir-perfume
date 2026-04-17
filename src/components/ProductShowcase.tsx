import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Clock, Volume2, ShieldCheck, Gem, History } from "lucide-react";
import { products, brands, collections, type Product } from "@/data";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";
import { MarqueeBand } from "./MarqueeBand";

const Meter = ({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between text-xs font-sans">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon} {label}
      </span>
      <span className="text-primary font-semibold">{value}%</span>
    </div>
    <div className="h-1 bg-secondary rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-primary rounded-full"
        initial={{ width: 0 }}
        whileInView={{ width: `${value}%` }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.3 }}
      />
    </div>
  </div>
);

const ProductCard = ({ product, index }: { product: Product; index: number }) => {
  const { addItem } = useCart();

  const handleAdd = () => {
    addItem({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      price: product.price,
      image: product.image,
    });
    toast.success(`${product.name} added to bag`, {
      icon: <ShieldCheck className="w-4 h-4 text-primary" />,
      className: "glass-panel border-primary/20"
    });
  };

  return (
  <motion.div
    layout
    initial={{ opacity: 0, y: 40 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.9 }}
    transition={{ duration: 0.5, delay: index * 0.05 }}
    id={`product-${product.id}`}
    className="glass-panel group overflow-hidden flex flex-col h-full"
  >
    {/* Image Container */}
    <div className="relative aspect-[4/5] overflow-hidden image-shine">
      <img
        src={product.image}
        alt={product.name}
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
      
      {/* Badges */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        {product.collection === "Limited" && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-primary text-primary-foreground text-[10px] tracking-widest uppercase font-bold rounded-full luxury-shadow">
            <Gem className="w-3 h-3" /> Limited
          </div>
        )}
        {product.collection === "Archive" && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-secondary text-foreground text-[10px] tracking-widest uppercase font-bold rounded-full luxury-shadow border border-gold/30">
            <History className="w-3 h-3 text-primary" /> Archive
          </div>
        )}
      </div>
    </div>

    <div className="p-6 space-y-5 flex-1 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-primary/60 text-[10px] font-sans tracking-[0.2em] uppercase font-semibold">{product.brand}</p>
          <h3 className="font-serif text-xl font-bold">{product.name}</h3>
          <p className="text-muted-foreground text-xs font-sans tracking-wider uppercase">{product.subtitle}</p>
        </div>
        <span className="font-serif text-xl gold-text font-bold whitespace-nowrap">{product.price}</span>
      </div>

      <p className="text-muted-foreground text-sm font-sans leading-relaxed line-clamp-2 italic">
        "{product.description}"
      </p>

      {/* Scent Pyramid */}
      <div className="space-y-3 pt-2">
        <h4 className="text-primary text-[10px] tracking-[0.25em] uppercase font-sans font-semibold flex items-center gap-2">
          Scent Pyramid <span className="h-px flex-1 bg-primary/20" />
        </h4>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[9px] text-muted-foreground tracking-wider uppercase mb-1 font-sans">Top</p>
            <p className="text-[10px] text-foreground/80 font-sans truncate px-1" title={product.topNotes.join(", ")}>
              {product.topNotes[0]}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground tracking-wider uppercase mb-1 font-sans">Heart</p>
            <p className="text-[10px] text-foreground/80 font-sans truncate px-1" title={product.heartNotes.join(", ")}>
              {product.heartNotes[0]}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground tracking-wider uppercase mb-1 font-sans">Base</p>
            <p className="text-[10px] text-foreground/80 font-sans truncate px-1" title={product.baseNotes.join(", ")}>
              {product.baseNotes[0]}
            </p>
          </div>
        </div>
      </div>

      {/* Meters */}
      <div className="space-y-3 pt-2">
        <Meter label="Longevity" value={product.longevity} icon={<Clock className="w-3 h-3" />} />
        <Meter label="Sillage" value={product.sillage} icon={<Volume2 className="w-3 h-3" />} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-5 mt-auto border-t border-border">
        <div className="flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5 text-primary fill-primary" />
          <span className="text-sm font-sans font-bold">{product.rating}</span>
          <span className="text-muted-foreground text-[10px] font-sans">({product.reviews.toLocaleString()})</span>
        </div>
        <button
          onClick={handleAdd}
          className="px-5 py-2 bg-primary text-primary-foreground text-[10px] tracking-[0.2em] uppercase font-sans font-bold hover:bg-gold-light transition-all duration-300 luxury-shadow"
        >
          Add to Bag
        </button>
      </div>
    </div>
  </motion.div>
);
};

const ProductShowcase = () => {
  const [activeBrand, setActiveBrand] = useState<string | null>(null);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);

  const filtered = products.filter((p) => {
    const brandMatch = activeBrand ? p.brand === activeBrand : true;
    const collectionMatch = activeCollection ? p.collection === activeCollection : true;
    return brandMatch && collectionMatch;
  });

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
          <p className="text-primary/80 text-xs tracking-[0.4em] uppercase mb-4 font-sans font-medium">The Archive & Collections</p>
          <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold mb-4">
            Curated <span className="gold-text italic">Excellence</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto font-sans leading-relaxed">
            From our core signatures to rare limited releases and historical archives. 
            Every bottle is a testament to obsessive craftsmanship.
          </p>
        </motion.div>

        {/* Marquee Filters */}
        <div className="space-y-2 mb-12">
          <MarqueeBand
            items={["All Houses", ...brands]}
            activeItem={activeBrand}
            onSelect={(item) => setActiveBrand(item === "All Houses" ? null : item)}
            speed={35}
          />
          <MarqueeBand
            items={["Entire Collection", ...collections]}
            activeItem={activeCollection}
            onSelect={(item) => setActiveCollection(item === "Entire Collection" ? null : item)}
            reverse
            speed={40}
          />
        </div>

        {/* Product Grid */}
        <motion.div 
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          <AnimatePresence mode='popLayout'>
            {filtered.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </AnimatePresence>
        </motion.div>

        {filtered.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <p className="text-muted-foreground font-serif italic text-xl">No fragrances match your selection.</p>
            <button 
              onClick={() => { setActiveBrand(null); setActiveCollection(null); }}
              className="mt-4 text-primary text-sm tracking-widest uppercase font-bold hover:underline"
            >
              Reset Filters
            </button>
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default ProductShowcase;
