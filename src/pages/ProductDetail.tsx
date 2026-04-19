import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Star, Clock, Volume2, Gem, History, ShoppingBag, ShieldCheck } from "lucide-react";
import { products, type Product } from "@/data";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";

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
  <span className="px-3 py-1.5 bg-secondary text-foreground text-xs font-sans tracking-wider uppercase border border-border rounded-full">
    {note}
  </span>
);

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const local = products.find((p) => p.id === id);
    if (local) {
      setProduct(local);
      setLoading(false);
      return;
    }

    fetch(`/api/products/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Product not found");
        return res.json();
      })
      .then((data) => {
        setProduct(data.product);
      })
      .catch(() => {
        toast.error("Product not found");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  const handleAdd = () => {
    if (!product) return;
    addItem({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      price: product.price,
      image: product.image,
    });
    toast.success(`${product.name} added to bag`, {
      icon: <ShieldCheck className="w-4 h-4 text-primary" />,
      className: "glass-panel border-primary/20",
    });
  };

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

  const related = products
    .filter((p) => p.id !== product.id && (p.brand === product.brand || p.collection === product.collection))
    .slice(0, 4);

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

          {/* Main Product */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20">
            {/* Image */}
            <div className="relative aspect-[4/5] overflow-hidden image-shine glass-panel">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
              <div className="absolute top-6 left-6 flex flex-col gap-2">
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

            {/* Info */}
            <div className="flex flex-col justify-center space-y-8">
              <div>
                <p className="text-primary/60 text-[10px] font-sans tracking-[0.2em] uppercase font-semibold mb-2">
                  {product.brand}
                </p>
                <h1 className="font-serif text-4xl sm:text-5xl font-bold mb-2">{product.name}</h1>
                <p className="text-muted-foreground text-sm font-sans tracking-wider uppercase mb-4">
                  {product.subtitle}
                </p>
                <p className="font-serif text-3xl gold-text font-bold">{product.price}</p>
              </div>

              <p className="text-muted-foreground text-base font-sans leading-relaxed italic">
                "{product.description}"
              </p>

              {/* Rating */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Star className="w-5 h-5 text-primary fill-primary" />
                  <span className="text-lg font-sans font-bold">{product.rating}</span>
                </div>
                <span className="text-muted-foreground text-sm font-sans">
                  {product.reviews.toLocaleString()} reviews
                </span>
              </div>

              {/* Meters */}
              <div className="space-y-4 max-w-sm">
                <Meter label="Longevity" value={product.longevity} icon={<Clock className="w-3.5 h-3.5" />} />
                <Meter label="Sillage" value={product.sillage} icon={<Volume2 className="w-3.5 h-3.5" />} />
              </div>

              {/* Add to bag */}
              <button
                onClick={handleAdd}
                className="w-full sm:w-auto px-10 py-4 bg-primary text-primary-foreground text-xs tracking-[0.2em] uppercase font-sans font-bold hover:bg-gold-light transition-all duration-300 luxury-shadow flex items-center justify-center gap-3"
              >
                <ShoppingBag className="w-4 h-4" /> Add to Bag — {product.price}
              </button>
            </div>
          </div>

          {/* Scent Pyramid */}
          <div className="glass-panel p-8 sm:p-12 mb-20">
            <h2 className="font-serif text-2xl font-bold mb-8 text-center">
              Scent <span className="gold-text italic">Pyramid</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div className="text-center space-y-4">
                <p className="text-primary text-xs tracking-[0.25em] uppercase font-sans font-semibold">Top Notes</p>
                <p className="text-muted-foreground text-xs font-sans">The first impression — bright and volatile</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {product.topNotes.map((note) => (
                    <NotePill key={note} note={note} />
                  ))}
                </div>
              </div>
              <div className="text-center space-y-4">
                <p className="text-primary text-xs tracking-[0.25em] uppercase font-sans font-semibold">Heart Notes</p>
                <p className="text-muted-foreground text-xs font-sans">The soul — revealed after minutes</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {product.heartNotes.map((note) => (
                    <NotePill key={note} note={note} />
                  ))}
                </div>
              </div>
              <div className="text-center space-y-4">
                <p className="text-primary text-xs tracking-[0.25em] uppercase font-sans font-semibold">Base Notes</p>
                <p className="text-muted-foreground text-xs font-sans">The foundation — lasting for hours</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {product.baseNotes.map((note) => (
                    <NotePill key={note} note={note} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Related Products */}
          {related.length > 0 && (
            <div>
              <h2 className="font-serif text-2xl font-bold mb-8">
                You May Also <span className="gold-text italic">Like</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {related.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                  >
                    <Link to={`/product/${p.id}`} className="block group">
                      <div className="relative aspect-[4/5] overflow-hidden mb-4">
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
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
