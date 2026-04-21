import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ShoppingBag, Trash2, Plus, Minus, ShieldCheck, MapPin, CreditCard, CheckCircle, Package, Navigation, Bookmark } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { TierBadge } from "@/components/ui/TierBadge";
import type { PaymentMethod } from "../../server/types";

interface ShippingForm {
  fullName: string;
  email: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
  phone: string;
  source?: "manual" | "saved" | "map";
  label?: string;
  latitude?: number;
  longitude?: number;
}

interface SavedAddress extends ShippingForm {
  id: string;
  nickname: string;
}

const SHIPPING_COST = 15;
const COD_LIMITS: Record<string, number> = {
  Bronze: 250,
  Silver: 250,
  Gold: 600,
  Platinum: 1200,
  Diamond: 2500,
  "The Alchemist Circle": 5000,
};

const ACCOUNT_BALANCE_TIERS = ["Silver", "Gold", "Platinum", "Diamond", "The Alchemist Circle"] as const;

function safeReadAddresses(key: string): SavedAddress[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWriteAddresses(key: string, addresses: SavedAddress[]) {
  try {
    localStorage.setItem(key, JSON.stringify(addresses));
  } catch {
    // ignore storage failures
  }
}

export default function Checkout() {
  const { items, removeItem, updateQuantity, clearCart, subtotal, sessionId } = useCart();
  const { user, isGuest, getIdToken, refreshProfile, profile, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect to login if not authenticated and not a guest
  useEffect(() => {
    if (!loading && !user && !isGuest) {
      toast.error("Please sign in or continue as guest to checkout");
      navigate("/login", { state: { from: "/checkout" } });
    }
  }, [user, isGuest, loading, navigate]);

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
  const [orderStatus] = useState<string>("Pending");
  const [addressMode, setAddressMode] = useState<"manual" | "saved" | "map">("manual");
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [saveAddressForFuture, setSaveAddressForFuture] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Card");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [completionNote, setCompletionNote] = useState("Your luxury fragrance journey has begun.");

  const total = subtotal + (subtotal > 0 ? SHIPPING_COST : 0);
  const savedAddressKey = user ? `noir-saved-addresses:${user.uid}` : "";
  const canPayOnDelivery = !!profile && profile.tier !== "Junior";
  const usesAccountBalance = !!profile && ACCOUNT_BALANCE_TIERS.includes(profile.tier as typeof ACCOUNT_BALANCE_TIERS[number]);
  const needsBronzeDeposit = profile?.tier === "Bronze";
  const payOnDeliveryLimit = profile ? COD_LIMITS[profile.tier] ?? 0 : 0;
  const bronzeDepositAmount = Number((total * 0.5).toFixed(2));
  const projectedAccountBalance = Number(((profile?.accountBalance ?? 0) - total).toFixed(2));

  const lineTotal = (price: string, qty: number) => {
    const val = Number(price.replace(/[^0-9.]/g, "")) || 0;
    return (val * qty).toFixed(2);
  };

  const handleChange = (field: keyof ShippingForm, value: string) => {
    setShipping((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    setShipping((prev) => ({
      ...prev,
      fullName: user?.displayName || prev.fullName,
      email: user?.email || prev.email,
    }));
  }, [user]);

  useEffect(() => {
    if (!mpesaPhone && shipping.phone) {
      setMpesaPhone(shipping.phone);
    }
  }, [shipping.phone, mpesaPhone]);

  useEffect(() => {
    if (!savedAddressKey) {
      setSavedAddresses([]);
      setAddressMode("manual");
      return;
    }

    const nextSaved = safeReadAddresses(savedAddressKey);
    setSavedAddresses(nextSaved);
    if (nextSaved.length > 0) {
      setSelectedAddressId(nextSaved[0].id);
    }
  }, [savedAddressKey]);

  useEffect(() => {
    if (addressMode !== "saved") return;
    const selected = savedAddresses.find((entry) => entry.id === selectedAddressId);
    if (!selected) return;
    setShipping(selected);
  }, [addressMode, savedAddresses, selectedAddressId]);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported on this device.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setShipping((prev) => ({
          ...prev,
          source: "map",
          latitude,
          longitude,
          address: prev.address || "Map-selected location",
        }));
        toast.success("Current location captured.");
      },
      () => {
        toast.error("Unable to fetch your current location.");
      }
    );
  };

  const persistSavedAddress = () => {
    if (!user || !saveAddressForFuture || !savedAddressKey) return;
    const nickname = shipping.label?.trim() || shipping.city || "Saved Address";
    const entry: SavedAddress = {
      ...shipping,
      id: `${Date.now()}`,
      nickname,
      source: addressMode,
    };
    const nextAddresses = [entry, ...savedAddresses.filter((item) => item.address !== entry.address)].slice(0, 5);
    setSavedAddresses(nextAddresses);
    safeWriteAddresses(savedAddressKey, nextAddresses);
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || !sessionId) {
      toast.error("Your bag is empty");
      return;
    }

    const required: Array<keyof Pick<ShippingForm, "fullName" | "email" | "address" | "city" | "country" | "postalCode">> = [
      "fullName",
      "email",
      "address",
      "city",
      "country",
      "postalCode",
    ];
    for (const field of required) {
      if (!shipping[field].trim()) {
        toast.error(`Please enter your ${field.replace(/([A-Z])/g, " $1").toLowerCase()}`);
        return;
      }
    }

    if (paymentMethod === "PayOnDelivery" && !canPayOnDelivery) {
      toast.error("Junior members do not yet have pay-on-delivery access.");
      return;
    }

    if (paymentMethod === "Mpesa" && !mpesaPhone.trim()) {
      toast.error("Enter the M-Pesa number that should receive the STK push.");
      return;
    }

    if (addressMode === "map" && (shipping.latitude == null || shipping.longitude == null)) {
      toast.error("Please capture or enter a map location.");
      return;
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
        body: JSON.stringify({
          sessionId,
          items,
          shipping: { ...shipping, source: addressMode },
          paymentMethod,
          paymentPhone: paymentMethod === "Mpesa" ? mpesaPhone : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Checkout failed");
      }

      setOrderId(data.orderId);
      persistSavedAddress();
      clearCart();
      setCompleted(true);
      setCompletionNote(
        paymentMethod === "Mpesa"
          ? data.mpesa?.mock
            ? data.mpesa?.customerMessage || "Sandbox payment completed successfully. Live credentials will replace this simulated charge later."
            : data.mpesa?.customerMessage || "Check your phone and complete the M-Pesa STK prompt to finish payment."
          : paymentMethod === "PayOnDelivery" && usesAccountBalance
            ? `This order has been posted to your running account. Projected balance: $${projectedAccountBalance.toFixed(2)}.`
            : paymentMethod === "PayOnDelivery" && needsBronzeDeposit
              ? `Your 50% Bronze deposit of $${bronzeDepositAmount.toFixed(2)} is recorded. The remaining $${Math.max(0, total - bronzeDepositAmount).toFixed(2)} must be cleared before admin finalization.`
          : "Your luxury fragrance journey has begun."
      );
      await refreshProfile();
      toast.success(`Order #${data.orderId} confirmed`, {
        description:
          paymentMethod === "Mpesa"
            ? data.mpesa?.mock
              ? data.mpesa?.customerMessage || "Sandbox payment completed."
              : data.mpesa?.customerMessage || `STK push sent to ${mpesaPhone}.`
            : `Total: $${data.total}`,
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
    const statuses = ["Pending", "Processing", "Shipped", "Out for Delivery", "Delivered"];
    const currentIndex = statuses.indexOf(orderStatus);

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 pt-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl w-full space-y-8"
        >
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          
          <div>
            <h1 className="font-serif text-3xl font-bold mb-2">Order Confirmed</h1>
            <p className="text-muted-foreground font-sans">
              Thank you, {shipping.fullName}. {completionNote}
            </p>
          </div>

          {/* Jumia-style Tracking Progress */}
          <div className="glass-panel p-8 space-y-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs tracking-[0.2em] uppercase font-bold text-primary">Live Tracking</h3>
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold uppercase tracking-widest">
                {orderStatus}
              </span>
            </div>
            
            <div className="relative flex justify-between">
              {statuses.map((s, idx) => (
                <div key={s} className="flex flex-col items-center relative z-10 w-1/5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                    idx <= currentIndex ? "bg-primary border-primary text-primary-foreground" : "bg-background border-border text-muted-foreground"
                  }`}>
                    {idx < currentIndex ? <CheckCircle className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                  </div>
                  <span className={`text-[9px] mt-2 font-bold uppercase tracking-tighter ${
                    idx <= currentIndex ? "text-primary" : "text-muted-foreground"
                  }`}>
                    {s}
                  </span>
                </div>
              ))}
              {/* Progress Line */}
              <div className="absolute top-4 left-[10%] right-[10%] h-0.5 bg-border -z-0">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(currentIndex / (statuses.length - 1)) * 100}%` }}
                  className="h-full bg-primary"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-border flex flex-col sm:flex-row justify-between gap-4 text-left">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Estimated Delivery</p>
                <p className="text-sm font-sans font-bold">Wednesday, 22 April 2026</p>
              </div>
              <div className="space-y-1 sm:text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Order ID</p>
                <p className="text-sm font-sans font-bold">#{orderId}</p>
              </div>
            </div>
          </div>

          {/* Tier Rewards Card */}
          {profile && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="glass-panel p-6 border-primary/20 bg-primary/5 flex items-center justify-between text-left"
            >
              <div className="space-y-1">
                <p className="text-xs font-bold tracking-widest uppercase text-primary">Status Updated</p>
                <div className="flex items-center gap-2">
                  <TierBadge tier={profile.tier} />
                  <span className="text-xs text-muted-foreground">+ {(total * 0.05).toFixed(2)} Noir Points earned</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Points</p>
                <p className="text-lg font-serif gold-text font-bold">{profile.points.toFixed(2)}</p>
              </div>
            </motion.div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/"
              className="px-12 py-3 bg-primary text-primary-foreground text-xs tracking-widest uppercase font-bold hover:bg-gold-light transition-colors inline-flex items-center justify-center gap-2"
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

                  <div className="grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => setAddressMode("manual")}
                      className={`px-4 py-3 text-xs tracking-widest uppercase font-bold border transition-colors ${addressMode === "manual" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
                    >
                      Manual Address
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddressMode("saved")}
                      disabled={savedAddresses.length === 0}
                      className={`px-4 py-3 text-xs tracking-widest uppercase font-bold border transition-colors disabled:opacity-50 ${addressMode === "saved" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
                    >
                      Saved Address
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddressMode("map")}
                      className={`px-4 py-3 text-xs tracking-widest uppercase font-bold border transition-colors ${addressMode === "map" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
                    >
                      Map Location
                    </button>
                  </div>

                  {addressMode === "saved" && (
                    <div className="space-y-3 glass-panel p-4">
                      <label className="text-xs tracking-widest uppercase text-muted-foreground font-bold">
                        Choose Saved Address
                      </label>
                      <select
                        value={selectedAddressId}
                        onChange={(e) => setSelectedAddressId(e.target.value)}
                        className="w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                      >
                        {savedAddresses.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.nickname} - {entry.address}, {entry.city}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

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
                        placeholder={addressMode === "map" ? "Apartment, building, or map note" : "123 Avenue des Champs-Élysées"}
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

                    {user && addressMode !== "saved" && (
                      <div className="space-y-2 sm:col-span-2">
                        <label className="text-xs tracking-widest uppercase text-muted-foreground font-bold">
                          Save Label
                        </label>
                        <input
                          type="text"
                          value={shipping.label || ""}
                          onChange={(e) => handleChange("label", e.target.value)}
                          className="w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                          placeholder="Home, Office, Gift Recipient"
                        />
                      </div>
                    )}
                  </div>

                  {addressMode === "map" && (
                    <div className="glass-panel p-4 space-y-4">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          type="button"
                          onClick={handleUseCurrentLocation}
                          className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-secondary text-foreground text-xs tracking-widest uppercase font-bold hover:bg-primary hover:text-primary-foreground transition-colors"
                        >
                          <Navigation className="w-4 h-4" /> Use Current Location
                        </button>
                        <a
                          href="https://www.google.com/maps"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-2 px-4 py-3 border border-border text-muted-foreground text-xs tracking-widest uppercase font-bold hover:text-foreground transition-colors"
                        >
                          <MapPin className="w-4 h-4" /> Open Map
                        </a>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-xs tracking-widest uppercase text-muted-foreground font-bold">Latitude</label>
                          <input
                            type="number"
                            value={shipping.latitude ?? ""}
                            onChange={(e) => setShipping((prev) => ({ ...prev, latitude: e.target.value === "" ? undefined : Number(e.target.value) }))}
                            className="w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                            placeholder="-1.2921"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs tracking-widest uppercase text-muted-foreground font-bold">Longitude</label>
                          <input
                            type="number"
                            value={shipping.longitude ?? ""}
                            onChange={(e) => setShipping((prev) => ({ ...prev, longitude: e.target.value === "" ? undefined : Number(e.target.value) }))}
                            className="w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                            placeholder="36.8219"
                          />
                        </div>
                      </div>

                      {shipping.latitude != null && shipping.longitude != null && (
                        <iframe
                          title="Map preview"
                          className="w-full h-64 border border-border"
                          loading="lazy"
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${shipping.longitude - 0.01}%2C${shipping.latitude - 0.01}%2C${shipping.longitude + 0.01}%2C${shipping.latitude + 0.01}&layer=mapnik&marker=${shipping.latitude}%2C${shipping.longitude}`}
                        />
                      )}
                    </div>
                  )}

                  {user && addressMode !== "saved" && (
                    <label className="flex items-center gap-3 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={saveAddressForFuture}
                        onChange={(e) => setSaveAddressForFuture(e.target.checked)}
                        className="accent-primary"
                      />
                      <span className="inline-flex items-center gap-2">
                        <Bookmark className="w-4 h-4 text-primary" /> Save this address for future checkouts
                      </span>
                    </label>
                  )}
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

                  <div className="space-y-3">
                    <p className="text-xs tracking-widest uppercase text-muted-foreground font-bold">Payment Method</p>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("Card")}
                      className={`w-full text-left px-4 py-3 border text-xs tracking-widest uppercase font-bold transition-colors ${paymentMethod === "Card" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
                    >
                      Card / Existing Pay Now
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("Mpesa")}
                      className={`w-full text-left px-4 py-3 border text-xs tracking-widest uppercase font-bold transition-colors ${paymentMethod === "Mpesa" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
                    >
                      M-Pesa STK Push
                    </button>
                    <button
                      type="button"
                      onClick={() => canPayOnDelivery && setPaymentMethod("PayOnDelivery")}
                      disabled={!canPayOnDelivery}
                      className={`w-full text-left px-4 py-3 border text-xs tracking-widest uppercase font-bold transition-colors disabled:opacity-50 ${paymentMethod === "PayOnDelivery" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
                    >
                      {needsBronzeDeposit ? "Bronze 50% Deposit" : usesAccountBalance ? "Account Balance / Credit" : "Pay on Delivery"}
                    </button>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      {!profile
                        ? "Sign in to unlock tier-based delivery payment options."
                        : profile.tier === "Junior"
                          ? "Junior tier does not include pay on delivery yet."
                          : needsBronzeDeposit
                            ? `Bronze orders require a 50% upfront deposit of $${bronzeDepositAmount.toFixed(2)}. Limit: $${payOnDeliveryLimit.toFixed(2)} per order.`
                            : `Your ${profile.tier} account can carry this order up to $${payOnDeliveryLimit.toFixed(2)}. Projected balance after checkout: $${projectedAccountBalance.toFixed(2)}.`}
                    </p>
                    {paymentMethod === "PayOnDelivery" && profile && (
                      <div className="rounded border border-primary/20 bg-primary/5 p-4 text-[10px] text-muted-foreground leading-relaxed">
                        {needsBronzeDeposit
                          ? `Bronze members pay 50% now and clear the rest before admin delivery finalization.`
                          : `Silver tier and above now use a running account balance instead of per-order partial payments. Positive balances act as deposits. Negative balances represent credit to settle later.`}
                      </div>
                    )}
                    {paymentMethod === "Mpesa" && (
                      <div className="space-y-2 rounded border border-primary/20 bg-primary/5 p-4">
                        <label className="text-[10px] tracking-widest uppercase text-primary font-bold">
                          M-Pesa Phone
                        </label>
                        <input
                          type="tel"
                          value={mpesaPhone}
                          onChange={(e) => setMpesaPhone(e.target.value)}
                          placeholder="0712345678"
                          className="w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Sandbox mode is active for now. This simulates a successful payment while live M-Pesa credentials are pending.
                        </p>
                      </div>
                    )}
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
