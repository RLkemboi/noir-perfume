import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Minus, ShoppingBag, Trash2, ArrowRight } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { Link } from "react-router-dom";

export const CartDrawer = () => {
  const { items, isOpen, setIsOpen, removeItem, updateQuantity, clearCart, subtotal } = useCart();

  const lineTotal = (price: string, qty: number) => {
    const val = Number(price.replace(/[^0-9.]/g, "")) || 0;
    return (val * qty).toFixed(2);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-background border-l border-border z-[101] shadow-2xl flex flex-col"
          >
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="font-serif text-2xl font-bold flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-primary" /> Your Bag
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close cart"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {items.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-muted-foreground font-serif italic text-lg">Your bag is empty.</p>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="mt-4 text-primary text-sm tracking-widest uppercase font-bold hover:underline"
                  >
                    Continue Shopping
                  </button>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.productId} className="flex gap-4 glass-panel p-4">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-20 h-24 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] text-primary/60 tracking-widest uppercase font-bold truncate">
                            {item.brand}
                          </p>
                          <h4 className="font-serif font-bold truncate">{item.name}</h4>
                        </div>
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            className="w-7 h-7 flex items-center justify-center border border-border hover:border-primary/40 transition-colors"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-sm font-sans font-semibold w-4 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            className="w-7 h-7 flex items-center justify-center border border-border hover:border-primary/40 transition-colors"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="font-serif gold-text font-bold whitespace-nowrap">
                          ${lineTotal(item.price, item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="p-6 border-t border-border space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-sans">Subtotal</span>
                  <span className="font-serif text-xl gold-text font-bold">${subtotal.toFixed(2)}</span>
                </div>
                <p className="text-muted-foreground text-xs font-sans">
                  Shipping & taxes calculated at checkout.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={clearCart}
                    className="px-4 py-3 border border-border text-muted-foreground text-xs tracking-widest uppercase font-bold hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    Clear
                  </button>
                  <Link
                    to="/checkout"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 px-4 py-3 bg-primary text-primary-foreground text-xs tracking-widest uppercase font-bold hover:bg-gold-light transition-colors luxury-shadow flex items-center justify-center gap-2"
                  >
                    Checkout <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
