import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Star, Clock, Volume2, Gem, History,
  ShoppingBag, ShieldCheck, Heart, Minus, Plus, X,
} from "lucide-react";
import { products, type Product } from "@/data";
import { SIZE_TIERS, DEFAULT_TIER, tierPrice, type SizeTier } from "@/data/sizeTiers";
import { rankProducts } from "@/utils/productRanking";
import { parsePrice, formatMoney, perDayLine } from "@/utils/pricing";
import { SCENT_OF_THE_WEEK_ID, scarcityLabel } from "@/config/storefront";
import { FeaturedBadge } from "@/components/ui/FeaturedBadge";
import { ExchangeNotice } from "@/components/ui/ExchangeNotice";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useWishlist } from "@/hooks/useWishlist";
import CommunityVoting from "@/components/product/CommunityVoting";
import { toast } from "sonner";
import { useSEO, buildProductSchema } from "@/hooks/useSEO";

// ── Sub-components ───────────────────────────────────────────────────────────

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
        animate={{ width: `${value}%` }}
        transition={{ duration: 1, delay: 0.3 }}
      />
    </div>
  </div>
);

const NotePill = ({ note }: { note: string }) => (
  <span className="px-3 py-1.5 bg-secondary text-foreground text-xs font-sans tracking-wider uppercase border border-primary/30 rounded-full">
    {note}
  </span>
);

interface TagPillProps {
  label: string;
  tag: string;
  onClick: (tag: string) => void;
}

const TagPill = ({ label, tag, onClick }: TagPillProps) => (
  <button
    onClick={() => onClick(tag)}
    className="px-3 py-1.5 bg-secondary/50 border border-border hover:border-primary/40 hover:bg-primary/5 text-foreground/70 hover:text-primary text-xs font-sans tracking-wider uppercase rounded-full transition-colors"
  >
    {label}
  </button>
);

// ── Review Modal ──────────────────────────────────────────────────────────────

interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  productName: string;
}

function ReviewModal({ open, onClose, productName }: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { user, getIdToken } = useAuth();
  const { sessionId } = useCart();

  const handleSubmit = async () => {
    if (rating < 1 || !text.trim()) return;
    setSubmitting(true);
    try {
      // Fetch user's most recent delivered order
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user) {
        const token = await getIdToken();
        headers.Authorization = `Bearer ${token}`;
      }
      const ordersRes = await fetch(
        user ? "/api/orders/me" : `/api/orders/session/${sessionId}`,
        { headers }
      );
      if (!ordersRes.ok) throw new Error("no_orders");
      const { orders } = await ordersRes.json();
      const delivered = (orders as Array<{ orderId: number; status: string }>)
        .filter((o) => o.status === "Delivered")
        .sort((a, b) => b.orderId - a.orderId);

      if (!delivered.length) {
        toast.error("Purchase first to leave a verified review.");
        return;
      }

      const latestId = delivered[0].orderId;
      const url = user
        ? `/api/orders/${latestId}/comment`
        : `/api/orders/${latestId}/comment?sessionId=${sessionId}`;

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ comment: text.trim(), reviewRating: rating }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { message?: string }).message || "Failed to submit");
      }
      toast.success("Review submitted — thank you!");
      onClose();
      setText("");
      setRating(0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit";
      if (msg === "no_orders") {
        toast.error("Purchase first to leave a verified review.");
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="glass-panel p-8 max-w-md w-full space-y-6 relative"
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="font-serif text-xl font-bold mb-1">Review This Fragrance</h3>
              <p className="text-muted-foreground text-sm font-sans">{productName}</p>
            </div>

            {/* Star picker */}
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  className="transition-transform hover:scale-110"
                  aria-label={`${star} star${star > 1 ? "s" : ""}`}
                >
                  <Star
                    className={`w-7 h-7 transition-colors ${
                      star <= (hovered || rating)
                        ? "text-primary fill-primary"
                        : "text-border"
                    }`}
                  />
                </button>
              ))}
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Share your experience with this fragrance…"
              rows={4}
              className="w-full bg-secondary/50 border border-border focus:border-primary/40 outline-none px-4 py-3 text-sm font-sans text-foreground placeholder:text-muted-foreground resize-none transition-colors"
            />

            <button
              onClick={handleSubmit}
              disabled={rating < 1 || !text.trim() || submitting}
              className="w-full py-3 bg-primary text-primary-foreground text-xs tracking-[0.2em] uppercase font-sans font-bold hover:bg-gold-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed luxury-shadow"
            >
              {submitting ? "Submitting…" : "Submit Review"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Static placeholder reviews ────────────────────────────────────────────────

const PLACEHOLDER_REVIEWS = [
  {
    initials: "AM",
    name: "Amina M.",
    date: "May 2025",
    stars: 5,
    text: "Absolutely stunning — the longevity is unreal. I get compliments every time I wear this to dinner. Worth every shilling.",
  },
  {
    initials: "JP",
    name: "James P.",
    date: "April 2025",
    stars: 5,
    text: "Ordered the Collector's bottle. The projection is incredible without being overwhelming. This is my go-to for boardroom days.",
  },
  {
    initials: "SK",
    name: "Sophia K.",
    date: "March 2025",
    stars: 4,
    text: "The packaging is beautiful and the scent is exactly as described. Slightly sweet but balanced. Definitely reordering.",
  },
];

// ── Helpers for Discovery Tags ────────────────────────────────────────────────

function getSeasonTags(product: Product): string[] {
  const el = product.tags.element;
  if (el === "oud" || el === "amber") return ["Winter", "Autumn"];
  if (el === "floral") return ["Spring", "Summer"];
  if (el === "fresh") return ["Summer", "Spring"];
  return ["All Season"];
}

function getOccasionTags(product: Product): string[] {
  const occ = product.tags.occasion;
  const map: Record<string, string[]> = {
    boardroom: ["Office", "Formal"],
    evening: ["Date Night", "Party"],
    intimate: ["Date Night", "Romantic"],
    signature: ["Versatile", "All Day"],
  };
  return map[occ] ?? ["Versatile"];
}

function getMoodTags(product: Product): string[] {
  const drive = product.tags.drive;
  const el = product.tags.element;
  const moods: string[] = [];
  if (drive === "power") moods.push("Bold", "Confident");
  if (drive === "mystery") moods.push("Dark", "Sensual");
  if (drive === "precision") moods.push("Clean", "Elegant");
  if (drive === "passion") moods.push("Sexy", "Romantic");
  if (el === "fresh") moods.push("Fresh");
  if (el === "floral") moods.push("Elegant");
  return [...new Set(moods)].slice(0, 4);
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { has: isWishlisted, toggle: toggleWishlist } = useWishlist();
  const [remote, setRemote] = useState<{ id: string; product: Product | null } | null>(null);
  const [tier, setTier] = useState<SizeTier>(DEFAULT_TIER);
  const [quantity, setQuantity] = useState(1);
  const [variant, setVariant] = useState<"copy" | "original">("copy");
  const [reviewOpen, setReviewOpen] = useState(false);

  const localProduct = products.find((p) => p.id === id) ?? null;
  const product = localProduct ?? (remote && remote.id === id ? remote.product : null);
  const loading = !localProduct && !!id && remote?.id !== id;

  useSEO(
    product
      ? {
          title: `${product.name} by ${product.brand} — ${product.subtitle}`,
          description: `${product.description} Top notes: ${product.topNotes.join(", ")}. Heart: ${product.heartNotes.join(", ")}. Base: ${product.baseNotes.join(", ")}. Rated ${product.rating}/5 by ${product.reviews.toLocaleString()} fragrance lovers.`,
          image: product.image.startsWith("http") ? product.image : `https://noir-perfume.onrender.com${product.image}`,
          url: `/product/${product.id}`,
          type: "product",
          structuredData: buildProductSchema(product),
        }
      : {}
  );

  useEffect(() => {
    if (!id || products.some((p) => p.id === id)) return;

    let cancelled = false;
    fetch(`/api/products/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Product not found");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setRemote({ id, product: data.product });
      })
      .catch(() => {
        if (cancelled) return;
        setRemote({ id, product: null });
        toast.error("Product not found");
      });

    return () => { cancelled = true; };
  }, [id]);

  const handleAdd = () => {
    if (!product) return;
    const variantLabel =
      variant === "original" ? "Original" : `Our version of ${product.name}`;
    for (let i = 0; i < quantity; i++) {
      addItem({
        productId: product.id,
        name: product.name,
        brand: product.brand,
        price: formatMoney(unitPrice),
        image: product.image,
        size: tier.size,
        variant,
        variantLabel,
      });
    }
    toast.success(`${product.name} (${tier.label} ${tier.size} × ${quantity}) added to bag`, {
      icon: <ShieldCheck className="w-4 h-4 text-primary" />,
      className: "glass-panel border-primary/20",
    });
  };

  const handleTagClick = (tag: string) => {
    navigate(`/collection?tag=${encodeURIComponent(tag)}`);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-xs tracking-widest uppercase">Loading...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground font-serif italic">This fragrance could not be found.</p>
          <Link
            to="/"
            className="inline-block px-6 py-3 bg-primary text-primary-foreground text-xs tracking-widest uppercase font-bold hover:bg-gold-light transition-colors"
          >
            Back to Store
          </Link>
        </div>
      </div>
    );
  }

  const related = rankProducts(
    products.filter((p) => p.id !== product.id && (p.brand === product.brand || p.collection === product.collection)),
    { hasActiveCategory: true }
  ).slice(0, 4);

  const basePrice = parsePrice(product.price);
  // Copy price = pre-computed stored value (falls back to legacy price for remote products).
  const copyPrice = product.copyPrice ?? basePrice;
  // Original retail = genuine article price (falls back to a sensible estimate if missing).
  const originalRetailKes = product.originalRetailKes ?? Math.round(basePrice * 5.5);
  const scentAccuracyPct = product.scentAccuracyPct ?? 88;
  const lh = product.longevityHours;
  const sLabel = product.sillageLabel;
  // The base price for the selected variant, before size-tier multiplier.
  const variantBase = variant === "original" ? originalRetailKes : copyPrice;
  const unitPrice = tierPrice(variantBase, tier);
  const savings = Math.max(0, originalRetailKes - copyPrice);
  const sillageDisplay = sLabel ? sLabel.charAt(0).toUpperCase() + sLabel.slice(1) : "";

  const seasonTags = getSeasonTags(product);
  const occasionTags = getOccasionTags(product);
  const moodTags = getMoodTags(product);

  const wishlisted = isWishlisted(product.id);

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-4">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Back link */}
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-muted-foreground text-xs tracking-widest uppercase font-bold hover:text-primary transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          {/* ── Section 1: Product Hero ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20">
            {/* Left: Image */}
            <div>
              <div className="relative aspect-[4/5] overflow-hidden image-shine glass-panel">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
                <div className="absolute top-6 left-6 flex flex-col items-start gap-2">
                  {product.id === SCENT_OF_THE_WEEK_ID && <FeaturedBadge />}
                  {product.collection === "Limited" && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-primary text-primary-foreground text-[10px] tracking-widest uppercase font-bold rounded-full luxury-shadow">
                      <Gem className="w-3 h-3" /> Limited
                    </div>
                  )}
                  {product.collection === "Archive" && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-secondary text-foreground text-[10px] tracking-widest uppercase font-bold rounded-full luxury-shadow border border-primary/30">
                      <History className="w-3 h-3 text-primary" /> Archive
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Info */}
            <div className="flex flex-col justify-center space-y-6">
              {/* Brand + Name */}
              <div>
                <p className="text-primary/60 text-[10px] font-sans tracking-[0.2em] uppercase font-semibold mb-2">
                  {product.brand}
                </p>
                <h1 className="font-serif text-4xl sm:text-5xl font-bold mb-2">{product.name}</h1>
                <p className="text-muted-foreground text-sm font-sans tracking-wider uppercase mb-1">
                  {product.subtitle}
                </p>
                {/* Inspired-by line for non-budget Western brands */}
                {product.brand !== "Lattafa" && parsePrice(product.price) > 5000 && (
                  <p className="text-muted-foreground/60 text-xs font-sans italic mb-2">
                    Inspired by the world of {product.brand}
                  </p>
                )}
                {scarcityLabel(product) && (
                  <p className="text-primary text-[10px] tracking-[0.2em] uppercase font-sans font-bold">
                    {scarcityLabel(product)}
                  </p>
                )}
              </div>

              {/* Rating */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-4 h-4 ${s <= Math.round(product.rating) ? "text-primary fill-primary" : "text-border"}`}
                    />
                  ))}
                </div>
                <span className="text-lg font-sans font-bold">{product.rating}</span>
                <span className="text-muted-foreground text-sm font-sans">
                  ({product.reviews.toLocaleString()} reviews)
                </span>
              </div>

              {/* Description */}
              <p className="text-muted-foreground text-base font-sans leading-relaxed italic">
                "{product.description}"
              </p>

              {/* ── Buy-box: variant selector (two cards) ───────────────────── */}
              <div className="space-y-2">
                <p className="text-primary text-[10px] tracking-[0.25em] uppercase font-sans font-semibold">Choose Your Option</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Original card */}
                  <button
                    onClick={() => setVariant("original")}
                    aria-pressed={variant === "original"}
                    className={`relative p-4 text-left border transition-colors ${
                      variant === "original"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <p className="text-[10px] tracking-[0.2em] uppercase font-sans font-semibold text-muted-foreground">Original</p>
                    <p className="font-serif text-base font-bold leading-tight mt-1">
                      {product.brand} {product.name}
                    </p>
                    <p className="font-serif gold-text font-bold mt-1">{formatMoney(originalRetailKes)}</p>
                    <p className="text-muted-foreground text-[11px] font-sans mt-2 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" /> Ships in 1–2 weeks
                    </p>
                    <p className="text-muted-foreground/70 text-[10px] font-sans italic mt-0.5">
                      Sourced from verified dealers
                    </p>
                  </button>

                  {/* Quality Copy card */}
                  <button
                    onClick={() => setVariant("copy")}
                    aria-pressed={variant === "copy"}
                    className={`relative p-4 text-left border transition-colors ${
                      variant === "copy"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <p className="text-[10px] tracking-[0.2em] uppercase font-sans font-semibold text-muted-foreground">Quality Copy</p>
                    <p className="font-serif text-base font-bold leading-tight mt-1">
                      Our version of {product.name}
                    </p>
                    <p className="font-serif gold-text font-bold mt-1">{formatMoney(copyPrice)}</p>
                    <p className="text-muted-foreground text-[11px] font-sans mt-2 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" /> Ships in 2–3 days
                    </p>
                    {savings > 0 && (
                      <p className="text-primary text-[11px] font-sans font-semibold mt-1">
                        Save KES {savings.toLocaleString()} vs original
                      </p>
                    )}
                    <p className="text-muted-foreground/70 text-[10px] font-sans mt-0.5">
                      ~{scentAccuracyPct}% scent match
                    </p>
                  </button>
                </div>
              </div>

              {/* ── Performance Stats (Noir in-house test) ──────────────────── */}
              <div className="space-y-3 glass-panel p-5">
                <p className="text-primary text-[10px] tracking-[0.25em] uppercase font-sans font-semibold">Performance</p>
                <div className="space-y-3">
                  <Meter
                    label={`Longevity${lh ? `  ${lh.min}–${lh.max} hrs` : ""}`}
                    value={product.longevity}
                    icon={<Clock className="w-3.5 h-3.5" />}
                  />
                  <Meter
                    label={`Sillage${sillageDisplay ? `  ${sillageDisplay}` : ""}`}
                    value={product.sillage}
                    icon={<Volume2 className="w-3.5 h-3.5" />}
                  />
                  {variant === "copy" && (
                    <Meter
                      label={`Scent match  ~${scentAccuracyPct}%`}
                      value={scentAccuracyPct}
                      icon={<Gem className="w-3.5 h-3.5" />}
                    />
                  )}
                </div>
                <p className="text-muted-foreground/60 text-[10px] font-sans italic">
                  Noir in-house test — independent measurements.
                </p>
              </div>

              {/* Size selector */}
              <div className="space-y-3">
                <p className="text-primary text-[10px] tracking-[0.25em] uppercase font-sans font-semibold">Choose Your Format</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {SIZE_TIERS.map((option) => {
                    const price = tierPrice(variantBase, option);
                    const active = tier.key === option.key;
                    return (
                      <button
                        key={option.key}
                        onClick={() => setTier(option)}
                        aria-pressed={active}
                        className={`relative p-4 text-left border transition-colors ${
                          active
                            ? "border-primary bg-primary/10"
                            : option.recommended
                              ? "border-primary/40 hover:border-primary"
                              : "border-border hover:border-primary/40"
                        }`}
                      >
                        {option.recommended && (
                          <span className="absolute -top-2.5 left-3 px-2 py-0.5 bg-primary text-primary-foreground text-[9px] tracking-widest uppercase font-bold rounded-full">
                            Most Chosen
                          </span>
                        )}
                        <p className="text-[10px] tracking-[0.2em] uppercase font-sans font-semibold text-muted-foreground">{option.label}</p>
                        <p className="font-serif text-lg font-bold">{option.size}</p>
                        <p className="font-serif gold-text font-bold">{formatMoney(price)}</p>
                      </button>
                    );
                  })}
                </div>
                <p className="text-muted-foreground text-[11px] font-sans">{perDayLine(unitPrice)}</p>
              </div>

              {/* Quantity stepper */}
              <div className="space-y-2">
                <p className="text-primary text-[10px] tracking-[0.25em] uppercase font-sans font-semibold">Quantity</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-9 h-9 flex items-center justify-center border border-border hover:border-primary/40 transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-sans font-bold">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    className="w-9 h-9 flex items-center justify-center border border-border hover:border-primary/40 transition-colors"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Add to bag + wishlist */}
              <div className="space-y-3">
                <div className="flex gap-3">
                  <button
                    onClick={handleAdd}
                    className="flex-1 py-4 bg-primary text-primary-foreground text-xs tracking-[0.2em] uppercase font-sans font-bold hover:bg-gold-light transition-all duration-300 luxury-shadow flex items-center justify-center gap-3"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    Add to Bag — {formatMoney(unitPrice * quantity)}
                  </button>
                  <button
                    onClick={() => toggleWishlist(product.id)}
                    aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                    className={`w-14 flex items-center justify-center border transition-colors ${
                      wishlisted
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40 text-muted-foreground hover:text-primary"
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${wishlisted ? "fill-primary" : ""}`} />
                  </button>
                </div>
                <ExchangeNotice />
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap gap-4 pt-2 border-t border-border/40">
                {["Long Lasting Oils", "Secure Checkout", "Fast Delivery", "Premium Packaging"].map((b) => (
                  <span key={b} className="flex items-center gap-1.5 text-muted-foreground text-xs font-sans">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" /> {b}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── Section 2: Discovery Tags ───────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-panel p-8 mb-20"
          >
            <h2 className="font-serif text-xl font-bold mb-6 text-center">
              Discover <span className="gold-text italic">by Mood & Occasion</span>
            </h2>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs tracking-[0.2em] uppercase font-sans font-semibold text-muted-foreground w-20 shrink-0">Season</span>
                {seasonTags.map((tag) => (
                  <TagPill key={tag} label={tag} tag={tag} onClick={handleTagClick} />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs tracking-[0.2em] uppercase font-sans font-semibold text-muted-foreground w-20 shrink-0">Occasion</span>
                {occasionTags.map((tag) => (
                  <TagPill key={tag} label={tag} tag={tag} onClick={handleTagClick} />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs tracking-[0.2em] uppercase font-sans font-semibold text-muted-foreground w-20 shrink-0">Mood</span>
                {moodTags.map((tag) => (
                  <TagPill key={tag} label={tag} tag={tag} onClick={handleTagClick} />
                ))}
              </div>
            </div>
          </motion.div>

          {/* ── Section 3: Scent Pyramid ────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-panel p-8 sm:p-12 mb-20"
          >
            <h2 className="font-serif text-2xl font-bold mb-8 text-center">
              Scent <span className="gold-text italic">Pyramid</span>
            </h2>

            {/* CSS Pyramid shape */}
            <div className="flex justify-center mb-8">
              <div className="relative flex flex-col items-center gap-0">
                <div className="w-0 h-0 border-l-[50px] border-r-[50px] border-b-[86px] border-l-transparent border-r-transparent border-b-primary/20" />
                <div className="flex text-[10px] tracking-[0.15em] uppercase font-sans font-semibold">
                  <span className="text-primary/60 w-24 text-left">Top</span>
                  <span className="text-primary/80 w-24 text-center">Middle</span>
                  <span className="text-primary/60 w-24 text-right">Base</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div className="text-center space-y-4">
                <p className="text-primary text-xs tracking-[0.25em] uppercase font-sans font-semibold">Top Notes</p>
                <p className="text-muted-foreground text-xs font-sans">The first impression — bright and volatile</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {product.topNotes.map((note) => <NotePill key={note} note={note} />)}
                </div>
              </div>
              <div className="text-center space-y-4">
                <p className="text-primary text-xs tracking-[0.25em] uppercase font-sans font-semibold">Heart Notes</p>
                <p className="text-muted-foreground text-xs font-sans">The soul — revealed after minutes</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {product.heartNotes.map((note) => <NotePill key={note} note={note} />)}
                </div>
              </div>
              <div className="text-center space-y-4">
                <p className="text-primary text-xs tracking-[0.25em] uppercase font-sans font-semibold">Base Notes</p>
                <p className="text-muted-foreground text-xs font-sans">The foundation — lasting for hours</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {product.baseNotes.map((note) => <NotePill key={note} note={note} />)}
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Section 4: Community Voting ─────────────────────────────────── */}
          <div className="mb-20">
            <CommunityVoting productId={product.id} />
          </div>

          {/* ── Section 5: Review CTA + Placeholder Reviews ─────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-20"
          >
            {/* CTA card */}
            <div className="glass-panel p-10 text-center mb-12">
              <div className="flex justify-center gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="w-6 h-6 text-primary fill-primary" />
                ))}
              </div>
              <p className="font-serif text-xl italic text-foreground/80 mb-2">
                "Be part of the Noir community."
              </p>
              <p className="text-muted-foreground text-sm font-sans mb-6">
                Share your experience and help others discover their signature scent.
              </p>
              <button
                onClick={() => setReviewOpen(true)}
                className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground text-xs tracking-[0.2em] uppercase font-sans font-bold hover:bg-gold-light transition-colors luxury-shadow"
              >
                <Star className="w-4 h-4" /> Review This Fragrance
              </button>
            </div>

            {/* Placeholder review cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {PLACEHOLDER_REVIEWS.map((review) => (
                <div key={review.name} className="glass-panel p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary text-xs font-bold font-sans">{review.initials}</span>
                    </div>
                    <div>
                      <p className="text-sm font-sans font-semibold">{review.name}</p>
                      <p className="text-xs text-muted-foreground font-sans">{review.date}</p>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${s <= review.stars ? "text-primary fill-primary" : "text-border"}`}
                      />
                    ))}
                  </div>
                  <p className="text-muted-foreground text-sm font-sans leading-relaxed">
                    "{review.text}"
                  </p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── Section 6: You May Also Like ────────────────────────────────── */}
          {related.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="font-serif text-2xl font-bold mb-8">
                You May Also <span className="gold-text italic">Like</span>
              </h2>
              {/* Horizontal scroll on mobile, grid on desktop */}
              <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0">
                {related.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.08 }}
                    className="min-w-[220px] snap-start lg:min-w-0"
                  >
                    <Link to={`/product/${p.id}`} className="block group">
                      <div className="relative aspect-[4/5] overflow-hidden mb-4 glass-panel">
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
                      </div>
                      <p className="text-primary/60 text-[10px] tracking-[0.2em] uppercase font-semibold">{p.brand}</p>
                      <h3 className="font-serif text-lg font-bold group-hover:text-primary transition-colors">{p.name}</h3>
                      <p className="font-serif gold-text font-bold">{p.price}</p>
                      <span className="mt-2 inline-block text-[10px] tracking-widest uppercase font-bold border border-border px-3 py-1.5 hover:border-primary/40 transition-colors text-muted-foreground group-hover:text-primary">
                        View
                      </span>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Review Modal */}
      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        productName={product.name}
      />
    </div>
  );
}
