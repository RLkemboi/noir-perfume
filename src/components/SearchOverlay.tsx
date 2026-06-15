import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { useStorefrontProducts } from "@/hooks/useStorefrontProducts";
import { rankProducts } from "@/utils/productRanking";

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

const SearchOverlay = ({ open, onClose }: SearchOverlayProps) => {
  const [query, setQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { products, brands } = useStorefrontProducts();

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      inputRef.current?.focus();
      setQuery("");
      setSelectedBrand(null);
    }, 100);
    return () => clearTimeout(id);
  }, [open]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const results = useMemo(() => {
    const matches = products.filter((p) => {
      const matchesBrand = selectedBrand ? p.brand === selectedBrand : true;
      const q = query.toLowerCase();
      const matchesQuery = q
        ? p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.subtitle.toLowerCase().includes(q) ||
          [...p.topNotes, ...p.heartNotes, ...p.baseNotes].some((n) =>
            n.toLowerCase().includes(q)
          )
        : true;
      return matchesBrand && matchesQuery;
    });
    return rankProducts(matches, { hasActiveCategory: Boolean(query || selectedBrand) });
  }, [products, query, selectedBrand]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex flex-col bg-background"
        >
          {/* Invisible backdrop below panel to close on outside click */}
          <div className="absolute inset-0" onClick={onClose} />

          {/* Panel */}
          <div className="relative z-10 w-full bg-background border-b border-border shadow-2xl">
            <div className="container mx-auto px-6 pt-8 pb-6 max-w-3xl">
              {/* Search Input */}
              <div className="flex items-center gap-4 border-b border-border pb-4">
                <Search className="w-5 h-5 text-primary shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search fragrances, notes, brands…"
                  aria-label="Search fragrances"
                  className="flex-1 bg-transparent text-foreground text-lg font-sans placeholder:text-muted-foreground focus:outline-none"
                />
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close search">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Brand Filters */}
              <div className="flex items-center gap-3 mt-4 flex-wrap">
                <SlidersHorizontal className="w-4 h-4 text-muted-foreground shrink-0" />
                <button
                  onClick={() => setSelectedBrand(null)}
                  className={`px-3 py-1 text-xs tracking-[0.1em] uppercase font-sans rounded-full border transition-colors ${
                    !selectedBrand
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  }`}
                >
                  All Brands
                </button>
                {brands.map((brand) => (
                  <button
                    key={brand}
                    onClick={() => setSelectedBrand(selectedBrand === brand ? null : brand)}
                    className={`px-3 py-1 text-xs tracking-[0.1em] uppercase font-sans rounded-full border transition-colors ${
                      selectedBrand === brand
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                    }`}
                  >
                    {brand}
                  </button>
                ))}
              </div>

              {/* Results */}
              <div className="mt-6 max-h-[55vh] overflow-y-auto space-y-1 pr-1">
                {!query && !selectedBrand ? (
                  <p className="text-muted-foreground text-sm text-center py-12 font-sans">
                    Type to search fragrances, notes, or brands…
                  </p>
                ) : results.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-12 font-sans">
                    No fragrances found. Try a different search.
                  </p>
                ) : (
                  results.map((product) => (
                    <Link
                      key={product.id}
                      to={`/product/${product.id}`}
                      onClick={onClose}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary transition-colors group"
                    >
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-14 h-14 object-cover rounded shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-serif text-sm font-semibold truncate">
                          {product.brand}{" "}
                          <span className="text-foreground">{product.name}</span>
                        </p>
                        <p className="text-muted-foreground text-xs font-sans truncate">
                          {product.subtitle} · {[...product.topNotes, ...product.heartNotes].slice(0, 3).join(", ")}
                        </p>
                      </div>
                      <span className="font-serif text-sm gold-text font-bold shrink-0">
                        {product.price}
                      </span>
                    </Link>
                  ))
                )}
              </div>

              {results.length > 0 && (query || selectedBrand) && (
                <p className="text-muted-foreground text-xs font-sans text-center mt-4 pb-1">
                  {results.length} fragrance{results.length !== 1 ? "s" : ""} found
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SearchOverlay;
