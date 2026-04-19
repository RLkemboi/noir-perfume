import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ShoppingBag, Trash2, Plus, Minus, ShieldCheck, MapPin, CreditCard, CheckCircle, Package } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface ShippingForm {
  fullName: string;
  email: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
  phone: string;
}

const SHIPPING_COST = 15;

export default function Checkout() {
  const { items, removeItem, updateQuantity, clearCart, subtotal, sessionId } = useCart();
  const { user, getIdToken } = useAuth();
  const navigate = useNavigate();

  const [shipping, setShipping] = useState<ShippingForm>({
    fullName: user?.displayName || "",
    email: user?.email || "",
    address: "",
    city: "",
    country: "",
    postalCode: "",
    phone: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);

  const total = subtotal + (subtotal > 0 ? SHIPPING_COST : 0);

  const lineTotal = (price: string, qty: number) => {
    const val = Number(price.replace(/[^0-9.]/g, "")) || 0;
    return (val * qty).toFixed(2);
  };

  const handleChange = (field: keyof ShippingForm, value: string) => {
    setShipping((prev) => ({ ...prev, [field]: value }));
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || !sessionId) {
      toast.error("Your bag is empty");
      return;
    }

    const required: (keyof ShippingForm)[] = ["fullName", "email", "address", "city", "country", "postalCode"];
    for (const field of required) {
      if (!shipping[field].trim()) {
        toast.error(`Please enter your ${field.replace(/([A-Z])/g, " $1").toLowerCase()}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user) {
        const token = await getIdToken();
        if (token) headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers,
        body: JSON.stringify({ sessionId, items, shipping }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Checkout failed");
      }

      setOrderId(data.orderId);
      clearCart();
      setCompleted(true);
      toast.success(`Order #${data.orderId} confirmed`, {
        description: `Total: $${data.total}`,
        className: "glass-panel border-primary/20",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed", {
        className: "glass-panel border-destructive/20",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (completed && orderId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-md space-y-6"
        >
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <div>
            <h1 className="font-serif text-3xl font-bold mb-2">Order Confirmed</h1>
            <p className="text-muted-foreground font-sans">
              Thank you, {shipping.fullName}. Your order has been received.
            </p>
          </div>
          <div className="glass-panel p-6 space-y-3 text-left">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground font-sans">Order Number</span>
              <span className="font-sans font-bold">#{orderId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground font-sans">Total</span>
              <span className="font-serif gold-text font-bold">${total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground font-sans">Email</span>
              <span className="font-sans">{shipping.email}</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/dashboard"
              className="px-8 py-3 bg-primary text-primary-foreground text-xs tracking-widest uppercase font-bold hover:bg-gold-light transition-colors inline-flex items-center justify-center gap-2"
            >
              <Package className="w-4 h-4" /> View Orders
            </Link>
            <Link
              to="/"
              className="px-8 py-3 border border-border text-muted-foreground text-xs tracking-widest uppercase font-bold hover:text-foreground hover:border-primary/40 transition-colors inline-flex items-center justify-center gap-2"
            >
              Continue Shopping
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-4">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-muted-foreground text-xs tracking-widest uppercase font-bold hover:text-primary transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <h1 className="font-serif text-3xl sm:text-4xl font-bold mb-10">
            Checkout <span className="gold-text italic">&</span> Shipping
          </h1>

          {items.length === 0 ? (
            <div className="text-center py-20 glass-panel">
              <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-serif italic text-lg mb-4">Your bag is empty.</p>
              <Link
                to="/"
                className="inline-block px-6 py-3 bg-primary text-primary-foreground text-xs tracking-widest uppercase font-bold hover:bg-gold-light transition-colors"
              >
                Continue Shopping
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
              {/* Left — Form + Items */}
              <div className="lg:col-span-3 space-y-10">
                {/* Order Items */}
                <div className="space-y-4">
                  <h2 className="font-serif text-xl font-bold flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-primary" /> Your Bag ({items.length})
                  </h2>
                  <AnimatePresence>
                    {items.map((item) => (
                      <motion.div
                        key={item.productId}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex gap-4 glass-panel p-4"
                      >
                        <Link to={`/product/${item.productId}`} className="shrink-0">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-20 h-24 object-cover rounded"
                          />
                        </Link>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                              <p className="text-[10px] text-primary/60 tracking-widest uppercase font-bold truncate">
                                {item.brand}
                              </p>
                              <Link to={`/product/${item.productId}`}>
                                <h4 className="font-serif font-bold truncate hover:text-primary transition-colors">
                                  {item.name}
                                </h4>
                              </Link>
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
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-sm font-sans font-semibold w-4 text-center">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                className="w-7 h-7 flex items-center justify-center border border-border hover:border-primary/40 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="font-serif gold-text font-bold whitespace-nowrap">
                              ${lineTotal(item.price, item.quantity)}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Shipping Form */}
                <form id="checkout-form" onSubmit={handlePlaceOrder} className="space-y-6">
                  <h2 className="font-serif text-xl font-bold flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" /> Shipping Details
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-xs tracking-widest uppercase text-muted-foreground font-bold">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={shipping.fullName}
                        onChange={(e) => handleChange("fullName", e.target.value)}
                        className="w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                        placeholder="John Doe"
                        required
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-xs tracking-widest uppercase text-muted-foreground font-bold">
                        Email
                      </label>
                      <input
                        type="email"
                        value={shipping.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                        className="w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                        placeholder="you@example.com"
                        required
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-xs tracking-widest uppercase text-muted-foreground font-bold">
                        Street Address
                      </label>
                      <input
                        type="text"
                        value={shipping.address}
                        onChange={(e) => handleChange("address", e.target.value)}
                        className="w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                        placeholder="123 Avenue des Champs-Élysées"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs tracking-widest uppercase text-muted-foreground font-bold">
                        City
                      </label>
                      <input
                        type="text"
                        value={shipping.city}
                        onChange={(e) => handleChange("city", e.target.value)}
                        className="w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                        placeholder="Paris"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs tracking-widest uppercase text-muted-foreground font-bold">
                        Postal Code
                      </label>
                      <input
                        type="text"
                        value={shipping.postalCode}
                        onChange={(e) => handleChange("postalCode", e.target.value)}
                        className="w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                        placeholder="75008"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs tracking-widest uppercase text-muted-foreground font-bold">
                        Country
                      </label>
                      <input
                        type="text"
                        value={shipping.country}
                        onChange={(e) => handleChange("country", e.target.value)}
                        className="w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                        placeholder="France"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs tracking-widest uppercase text-muted-foreground font-bold">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={shipping.phone}
                        onChange={(e) => handleChange("phone", e.target.value)}
                        className="w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                        placeholder="+33 1 23 45 67 89"
                      />
                    </div>
                  </div>
                </form>
              </div>

              {/* Right — Summary */}
              <div className="lg:col-span-2">
                <div className="glass-panel p-8 sticky top-24 space-y-6">
                  <h2 className="font-serif text-xl font-bold flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" /> Order Summary
                  </h2>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">Subtotal</span>
                      <span className="font-sans font-semibold">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">Shipping</span>
                      <span className="font-sans font-semibold">${subtotal > 0 ? SHIPPING_COST.toFixed(2) : "0.00"}</span>
                    </div>
                    <div className="border-t border-border pt-3 flex justify-between">
                      <span className="font-sans font-bold tracking-wider uppercase">Total</span>
                      <span className="font-serif text-xl gold-text font-bold">${total.toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    form="checkout-form"
                    disabled={submitting}
                    className="w-full py-4 bg-primary text-primary-foreground text-xs tracking-[0.2em] uppercase font-sans font-bold hover:bg-gold-light transition-all duration-300 luxury-shadow disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    {submitting ? "Placing Order..." : `Place Order — $${total.toFixed(2)}`}
                  </button>

                  <p className="text-[10px] text-muted-foreground text-center font-sans leading-relaxed">
                    Shipping & taxes included. All transactions are secured.
                    <br />
                    Your order will be processed and shipped within 2–3 business days.
                  </p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
