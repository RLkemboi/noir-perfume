import { motion } from "framer-motion";
import { Star, Clock, Volume2, ShieldCheck, Gem, History, ArrowUpRight, Heart, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/hooks/useWishlist";
import { FeaturedBadge } from "@/components/ui/FeaturedBadge";
import { SCENT_OF_THE_WEEK_ID, scarcityLabel } from "@/config/storefront";
import { perDayLine, formatMoney } from "@/utils/pricing";
import { parsePrice } from "@/utils/productRanking";
import type { StorefrontProduct as Product } from "@/utils/storefrontProductAdapter";

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

export const ProductCard = ({ product, index }: { product: Product; index: number }) => {
  const { addItem } = useCart();
  const { has, toggle } = useWishlist();
  const wished = has(product.id);
  const scarcity = scarcityLabel(product);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const copyPrice = product.copyPrice ?? parsePrice(product.price);
    addItem({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      price: formatMoney(copyPrice),
      image: product.image,
      variant: "copy",
      variantLabel: `Our version of ${product.name}`,
    });
    toast.success(`${product.name} added to bag`, {
      icon: <ShieldCheck className="w-4 h-4 text-primary" />,
      className: "glass-panel border-primary/20"
    });
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(product.id);
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
    <Link to={`/product/${product.id}`} className="flex flex-col h-full">
      {/* Image Container */}
      <div className="relative aspect-[4/5] overflow-hidden image-shine">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />

        {/* View overlay */}
        <div className="absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <span className="px-5 py-2.5 bg-primary text-primary-foreground text-[10px] tracking-[0.2em] uppercase font-sans font-bold flex items-center gap-2 luxury-shadow">
            View Details <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        </div>

        {/* Badges */}
        <div className="absolute top-4 left-4 flex flex-col items-start gap-2">
          {product.id === SCENT_OF_THE_WEEK_ID && <FeaturedBadge />}
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
          {scarcity && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-background/80 text-foreground text-[10px] tracking-widest uppercase font-bold rounded-full border border-primary/40">
              <Flame className="w-3 h-3 text-primary" /> {scarcity}
            </div>
          )}
        </div>

        {/* Wishlist */}
        <button
          onClick={handleWishlist}
          aria-label={wished ? `Remove ${product.name} from shortlist` : `Add ${product.name} to shortlist`}
          aria-pressed={wished}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-background/70 backdrop-blur flex items-center justify-center border border-border hover:border-primary/50 transition-colors"
        >
          <Heart className={`w-4 h-4 transition-colors ${wished ? "text-primary fill-primary" : "text-foreground/70"}`} />
        </button>
      </div>

      <div className="p-6 space-y-5 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-primary/60 text-[10px] font-sans tracking-[0.2em] uppercase font-semibold">{product.brand}</p>
            <h3 className="font-serif text-xl font-bold">{product.name}</h3>
            <p className="text-muted-foreground text-xs font-sans tracking-wider uppercase">{product.subtitle}</p>
          </div>
          <div className="text-right">
            <span className="font-serif text-xl gold-text font-bold whitespace-nowrap">
              from {formatMoney(product.copyPrice ?? parsePrice(product.price))}
            </span>
            {product.originalRetailKes && product.originalRetailKes > (product.copyPrice ?? parsePrice(product.price)) && (
              <p className="text-muted-foreground text-[9px] font-sans mt-0.5 line-through">
                orig. {formatMoney(product.originalRetailKes)}
              </p>
            )}
            <p className="text-muted-foreground text-[9px] font-sans mt-0.5 max-w-[110px]">{perDayLine(product.copyPrice ?? parsePrice(product.price))}</p>
          </div>
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
    </Link>
  </motion.div>
);
};
