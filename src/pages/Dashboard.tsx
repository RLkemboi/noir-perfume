import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogOut, Package, User, ShoppingBag, Clock, Sparkles, Settings, ShieldCheck, ChevronRight, MessageSquare, Send, Store, CheckCircle2, MapPin, Star } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";
import { TierBadge } from "@/components/ui/TierBadge";
import type { Order } from "../../server/types";

export default function Dashboard() {
  const { user, profile, logout, isGuest, getIdToken, refreshProfile, loading: authLoading } = useAuth();
  const { sessionId } = useCart();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingComment, setSubmittingComment] = useState<number | null>(null);
  const [commentText, setCommentText] = useState<Record<number, string>>({});
  const [reviewRatings, setReviewRatings] = useState<Record<number, number>>({});
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [confirmingReceiptId, setConfirmingReceiptId] = useState<number | null>(null);
  const [requestingPromptId, setRequestingPromptId] = useState<number | null>(null);
  const [payingOrderId, setPayingOrderId] = useState<number | null>(null);
  const [requestingMpesaId, setRequestingMpesaId] = useState<number | null>(null);
  const [mpesaPhone, setMpesaPhone] = useState<Record<number, string>>({});
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);

  useEffect(() => {
    // Role-based redirection for approved staff
    if (profile && profile.isApproved) {
      if (profile.role === "DeliveryAgent") navigate("/agent");
      if (profile.role === "Admin") navigate("/admin");
      if (profile.role === "Operator") navigate("/operator");
      if (profile.role === "Marketing") navigate("/marketing");
    }
  }, [profile, navigate]);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        if (user) {
          const token = await getIdToken();
          const res = await fetch("/api/orders/me", {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (res.ok) {
            const data = await res.json();
            setOrders(data.orders || []);
          } else {
            const data = await res.json().catch(() => ({}));
            toast.error(data.message || "Failed to load orders");
          }
        } else if (isGuest) {
          const res = await fetch(`/api/orders/session/${sessionId}`);
          if (res.ok) {
            const data = await res.json();
            setOrders(data.orders || []);
          } else {
            const data = await res.json().catch(() => ({}));
            toast.error(data.message || "Failed to load orders");
          }
        }
      } catch {
        toast.error("Unable to load orders. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    loadOrders();
  }, [user, isGuest, getIdToken, sessionId]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
      toast.success("Logged out successfully");
    } catch {
      toast.error("Logout failed");
    }
  };

  const handleSubmitComment = async (orderId: number) => {
    const text = commentText[orderId];
    if (!text?.trim()) return;
    const reviewRating = reviewRatings[orderId];
    if (!reviewRating) {
      toast.error("Please add a star rating before submitting your review.");
      return;
    }

    setSubmittingComment(orderId);
    try {
      const { headers, suffix } = await buildOrderAccess();
      headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/orders/${orderId}/comment${suffix}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ comment: text, reviewRating }),
      });
      if (res.ok) {
        toast.success("Thank you for your feedback!");
        setOrders(prev => prev.map(o => o.orderId === orderId ? { ...o, comment: text, reviewRating } : o));
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to submit review");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit comment");
    } finally {
      setSubmittingComment(null);
    }
  };

  const handleConfirmReceipt = async (orderId: number) => {
    setConfirmingReceiptId(orderId);
    try {
      const headers: Record<string, string> = {};
      let url = `/api/orders/${orderId}/customer-confirm`;

      if (user) {
        const token = await getIdToken();
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      } else if (isGuest) {
        url += `?sessionId=${encodeURIComponent(sessionId)}`;
      }

      const res = await fetch(url, { method: "POST", headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to confirm receipt");
      }

      setOrders((prev) => prev.map((order) => (order.orderId === orderId ? data.order : order)));
      toast.success("Your delivery confirmation has been recorded.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to confirm receipt";
      toast.error(message);
    } finally {
      setConfirmingReceiptId(null);
    }
  };

  const getConfirmationTone = (order: Order) => {
    if (order.customerDeliveryConfirmed && order.agentDeliveryConfirmed) {
      return "bg-emerald-500/10 text-emerald-500";
    }
    if (order.customerDeliveryConfirmed || order.agentDeliveryConfirmed) {
      return "bg-red-500/10 text-red-500";
    }
    return "bg-yellow-500/10 text-yellow-500";
  };

  const buildOrderAccess = async () => {
    const headers: Record<string, string> = {};
    let suffix = "";
    if (user) {
      const token = await getIdToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    } else if (isGuest) {
      suffix = `?sessionId=${encodeURIComponent(sessionId)}`;
    }
    return { headers, suffix };
  };

  const handleRequestPaymentPrompt = async (order: Order) => {
    setRequestingPromptId(order.orderId);
    try {
      const { headers, suffix } = await buildOrderAccess();
      const res = await fetch(`/api/orders/${order.orderId}/request-payment-prompt${suffix}`, {
        method: "POST",
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to request payment prompt");
      setOrders((prev) => prev.map((entry) => (entry.orderId === order.orderId ? data.order : entry)));
      toast.success("Payment prompt sent.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to request payment prompt");
    } finally {
      setRequestingPromptId(null);
    }
  };

  const handlePayNow = async (order: Order) => {
    const amount = Number(order.amountDue);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("This order has no remaining balance.");
      return;
    }

    setPayingOrderId(order.orderId);
    try {
      const { headers, suffix } = await buildOrderAccess();
      headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/orders/${order.orderId}/pay${suffix}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ amount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Payment failed");
      setOrders((prev) => prev.map((entry) => (entry.orderId === order.orderId ? data.order : entry)));
      toast.success("Remaining order balance cleared.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setPayingOrderId(null);
    }
  };

  const handleDeposit = async () => {
    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid deposit amount.");
      return;
    }

    setDepositing(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/user/account/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ amount }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Deposit failed");
      await refreshProfile();
      setDepositAmount("");
      toast.success(`$${amount.toFixed(2)} added to your account balance.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setDepositing(false);
    }
  };

  const handleMpesaRetry = async (order: Order) => {
    setRequestingMpesaId(order.orderId);
    try {
      const { headers, suffix } = await buildOrderAccess();
      headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/orders/${order.orderId}/mpesa-stk${suffix}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ phoneNumber: mpesaPhone[order.orderId] || order.paymentPhone || order.shipping?.phone || "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to send M-Pesa prompt");
      setOrders((prev) => prev.map((entry) => (entry.orderId === order.orderId ? data.order : entry)));
      toast.success(data.mpesa?.customerMessage || "M-Pesa STK push sent.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send M-Pesa prompt");
    } finally {
      setRequestingMpesaId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-xs tracking-widest uppercase">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user && !isGuest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground font-serif italic">Please sign in to view your account.</p>
          <Link
            to="/login"
            className="inline-block px-6 py-3 bg-primary text-primary-foreground text-xs tracking-widest uppercase font-bold hover:bg-gold-light transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const displayName = user?.displayName || user?.email || "Guest";

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-4">
      <div className="container mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-serif text-3xl font-bold gold-text">My Account</h1>
              <p className="text-muted-foreground text-sm mt-1">{displayName}</p>
              {isGuest && (
                <p className="text-[10px] text-primary/60 tracking-widest uppercase mt-1">
                  Guest Session — <Link to="/signup" className="underline hover:text-primary">Sign up to save your history</Link>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="flex items-center gap-2 px-4 py-2 border border-border text-muted-foreground text-xs tracking-widest uppercase font-bold hover:text-foreground hover:border-primary/40 transition-colors"
              >
                <Store className="w-4 h-4" /> Return to Shopping
              </Link>
              {user && profile?.role === "Admin" && (
                <Link
                  to="/admin"
                  className="flex items-center gap-2 px-4 py-2 border border-primary/40 bg-primary/5 text-primary text-xs tracking-widest uppercase font-bold hover:bg-primary/10 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" /> Admin Panel
                </Link>
              )}
              {user && (
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-4 py-2 border border-border text-muted-foreground text-xs tracking-widest uppercase font-bold hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  <Settings className="w-4 h-4" /> Settings
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 border border-border text-muted-foreground text-xs tracking-widest uppercase font-bold hover:text-foreground hover:border-primary/40 transition-colors"
              >
                <LogOut className="w-4 h-4" /> {user ? "Sign Out" : "End Session"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="glass-panel p-6 text-center">
              <ShoppingBag className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-serif font-bold">{orders.length}</p>
              <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold">Orders</p>
            </div>
            <div className="glass-panel p-6 text-center">
              {profile ? (
                <>
                  <Sparkles className="w-6 h-6 text-primary mx-auto mb-2" />
                  <p className={`text-2xl font-serif font-bold ${(profile.accountBalance ?? 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    ${Math.abs(profile.accountBalance ?? 0).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold">
                    {(profile.accountBalance ?? 0) >= 0 ? "Account Balance" : "Account Credit Owed"}
                  </p>
                </>
              ) : (
                <>
                  <Clock className="w-6 h-6 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-serif font-bold">
                    {orders.filter((o) => o.createdAt && new Date(o.createdAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000).length}
                  </p>
                  <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold">This Week</p>
                </>
              )}
            </div>
            <div className="glass-panel p-6 text-center">
              {profile ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <TierBadge tier={profile.tier} className="mb-2" />
                  <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold">Current Tier</p>
                  <p className="mt-2 text-xs text-muted-foreground">{profile.points || 0} Noir Points</p>
                </div>
              ) : (
                <>
                  <User className="w-6 h-6 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-serif font-bold">Guest</p>
                  <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold">Status</p>
                </>
              )}
            </div>
          </div>

          {user && profile && (
            <div className="glass-panel p-6 mb-8 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="font-serif text-xl font-bold">Account Balance</h2>
                  <p className="text-xs text-muted-foreground">
                    Silver tier and above can use account credit at checkout. Bronze pays a 50% delivery deposit. Junior has no delivery credit yet.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Current Balance</p>
                  <p className={`text-2xl font-serif font-bold ${(profile.accountBalance ?? 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    ${(profile.accountBalance ?? 0).toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="flex flex-col md:flex-row gap-3">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Add funds to your account"
                  className="flex-1 bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
                />
                <button
                  onClick={handleDeposit}
                  disabled={depositing}
                  className="px-4 py-2 bg-primary text-primary-foreground text-[10px] tracking-widest uppercase font-bold hover:bg-gold-light disabled:opacity-50"
                >
                  {depositing ? "Adding..." : "Add Funds"}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Positive balances are prepaid deposits. Negative balances show purchases taken on account and still to be settled.
              </p>
            </div>
          )}

          <div className="glass-panel p-6">
            <h2 className="font-serif text-xl font-bold mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" /> Order History
            </h2>

            {loading ? (
              <p className="text-muted-foreground text-sm">Loading orders...</p>
            ) : orders.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground font-serif italic">No orders yet.</p>
                <Link
                  to="/"
                  className="inline-block mt-4 text-primary text-xs tracking-widest uppercase font-bold hover:underline"
                >
                  Start Shopping
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div
                    key={order.orderId}
                    className="group glass-panel p-5 border-border hover:border-primary/40 transition-all duration-300"
                  >
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <p className="text-xs text-primary font-bold tracking-[0.2em] uppercase">
                            Order #{order.orderId}
                          </p>
                          <span className={`text-[9px] px-2 py-0.5 rounded uppercase font-bold tracking-widest ${
                            order.status === "Delivered" ? "bg-emerald-500/10 text-emerald-500" :
                            order.status === "Cancelled" ? "bg-destructive/10 text-destructive" :
                            "bg-primary/10 text-primary"
                          }`}>
                            {order.status || "Processing"}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {order.items.slice(0, 3).map((item, idx) => (
                            <img 
                              key={idx} 
                              src={item.image} 
                              alt={item.name} 
                              className="w-10 h-10 object-cover rounded border border-border"
                            />
                          ))}
                          {order.items.length > 3 && (
                            <div className="w-10 h-10 flex items-center justify-center bg-secondary/50 rounded border border-border text-[10px] font-bold">
                              +{order.items.length - 3}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex flex-col justify-between items-end">
                        <div>
                          <p className="font-serif gold-text font-bold text-lg">${order.total.toFixed(2)}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {order.createdAt ? new Date(order.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric', month: 'short', day: 'numeric'
                            }) : ""}
                          </p>
                        </div>
                        <button
                          onClick={() => setExpandedOrderId((current) => (current === order.orderId ? null : order.orderId))}
                          className="text-[10px] tracking-widest uppercase font-bold flex items-center gap-1 text-primary hover:gap-2 transition-all"
                        >
                          {expandedOrderId === order.orderId ? "Hide Details" : "Track Details"} <ChevronRight className={`w-3 h-3 transition-transform ${expandedOrderId === order.orderId ? "rotate-90" : ""}`} />
                        </button>
                      </div>
                    </div>

                    {expandedOrderId === order.orderId && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-6 pt-4 border-t border-border/40 space-y-4"
                      >
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Delivery Address</p>
                            <p className="text-sm flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-primary mt-0.5" />
                              <span>
                                {order.shipping?.address || "No address provided"}
                                {order.shipping?.city ? `, ${order.shipping.city}` : ""}
                                {order.shipping?.country ? `, ${order.shipping.country}` : ""}
                              </span>
                            </p>
                            {order.shipping?.label && (
                              <p className="text-xs text-muted-foreground">Saved label: {order.shipping.label}</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Payment</p>
                            <p className="text-sm">
                              {order.paymentMethod === "PayOnDelivery"
                                ? order.paymentReference === "BRONZE-50PCT-DEPOSIT"
                                  ? "Bronze Delivery Deposit"
                                  : "Account Balance / Credit"
                                : order.paymentMethod === "Mpesa"
                                  ? "M-Pesa STK Push"
                                  : "Card"}
                            </p>
                            {order.paymentMethod === "PayOnDelivery" && (
                              <div className="space-y-1 text-xs text-muted-foreground">
                                <p>Paid ${order.amountPaid.toFixed(2)} of ${order.total.toFixed(2)}. Remaining: ${order.amountDue.toFixed(2)}.</p>
                                <p>
                                  {order.paymentReference === "BRONZE-50PCT-DEPOSIT"
                                    ? "Bronze orders require the full remaining balance before admin finalization."
                                    : "Silver tier and above use a running account balance instead of per-order partial payments."}
                                </p>
                              </div>
                            )}
                            {order.paymentMethod === "Mpesa" && (
                              <div className="space-y-1 text-xs text-muted-foreground">
                                <p>Paid ${order.amountPaid.toFixed(2)} of ${order.total.toFixed(2)}. Remaining: ${order.amountDue.toFixed(2)}.</p>
                                {order.paymentPhone && <p>Phone: {order.paymentPhone}</p>}
                                {order.paymentReference && <p>Receipt: {order.paymentReference}</p>}
                                {order.paymentLastError && <p className="text-destructive">{order.paymentLastError}</p>}
                              </div>
                            )}
                            <p className={`inline-flex px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${getConfirmationTone(order)}`}>
                              {order.customerDeliveryConfirmed && order.agentDeliveryConfirmed
                                ? "Both Confirmed"
                                : order.customerDeliveryConfirmed || order.agentDeliveryConfirmed
                                  ? "Partially Confirmed"
                                  : "Awaiting Confirmation"}
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-2 md:grid-cols-3">
                          <div className={`rounded border px-3 py-3 text-xs ${order.agentDeliveryConfirmed ? "border-emerald-500/30 bg-emerald-500/5" : "border-yellow-500/30 bg-yellow-500/5"}`}>
                            <p className="font-bold uppercase tracking-widest text-[10px]">Agent</p>
                            <p className="mt-1">{order.agentDeliveryConfirmed ? "Delivery agent confirmed handoff." : "Waiting for delivery agent confirmation."}</p>
                          </div>
                          <div className={`rounded border px-3 py-3 text-xs ${order.customerDeliveryConfirmed ? "border-emerald-500/30 bg-emerald-500/5" : "border-yellow-500/30 bg-yellow-500/5"}`}>
                            <p className="font-bold uppercase tracking-widest text-[10px]">Customer</p>
                            <p className="mt-1">{order.customerDeliveryConfirmed ? "You confirmed receipt." : "Your confirmation is still pending."}</p>
                          </div>
                          <div className={`rounded border px-3 py-3 text-xs ${order.adminDeliveryConfirmed ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-secondary/20"}`}>
                            <p className="font-bold uppercase tracking-widest text-[10px]">Admin</p>
                            <p className="mt-1">{order.adminDeliveryConfirmed ? "Admin finalized the completed delivery." : "Admin finalization pending."}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Status Timeline</p>
                          <div className="space-y-2">
                            {order.statusHistory.map((entry) => (
                              <div key={`${entry.status}-${entry.date}`} className="flex items-center justify-between text-xs border border-border/50 rounded px-3 py-2">
                                <span className="font-bold">{entry.status}</span>
                                <span className="text-muted-foreground">{new Date(entry.date).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {order.paymentMethod === "PayOnDelivery" && (
                          <div className="space-y-3 border border-border/50 rounded p-4">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Payment Features</p>
                                <p className="text-xs text-muted-foreground">
                                  Status: {order.paymentStatus}. Prompt requests: {order.paymentPromptCount || 0}
                                  {order.payOnDeliveryLimit ? ` • Tier limit: $${order.payOnDeliveryLimit.toFixed(2)}` : ""}
                                </p>
                              </div>
                              {order.amountDue > 0 && (
                                <button
                                  onClick={() => handleRequestPaymentPrompt(order)}
                                  disabled={requestingPromptId === order.orderId}
                                  className="px-4 py-2 border border-border text-[10px] tracking-widest uppercase font-bold text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-50"
                                >
                                  {requestingPromptId === order.orderId ? "Sending..." : "Request Payment Prompt"}
                                </button>
                              )}
                            </div>

                            {order.amountDue > 0 && (
                              <div className="flex flex-col md:flex-row gap-3">
                                <button
                                  onClick={() => handlePayNow(order)}
                                  disabled={payingOrderId === order.orderId}
                                  className="px-4 py-2 bg-primary text-primary-foreground text-[10px] tracking-widest uppercase font-bold hover:bg-gold-light disabled:opacity-50"
                                >
                                  {payingOrderId === order.orderId ? "Processing..." : `Pay Remaining $${order.amountDue.toFixed(2)}`}
                                </button>
                              </div>
                            )}
                            {order.amountDue <= 0 && (
                              <p className="text-xs text-emerald-500">
                                This delivery order is fully settled and ready for admin finalization after both delivery confirmations.
                              </p>
                            )}
                          </div>
                        )}

                        {order.paymentMethod === "Mpesa" && order.amountDue > 0 && (
                          <div className="space-y-3 border border-border/50 rounded p-4">
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">M-Pesa Payment</p>
                              <p className="text-xs text-muted-foreground">
                                Send an STK push to complete the remaining balance from your Safaricom phone.
                              </p>
                            </div>
                            <div className="flex flex-col md:flex-row gap-3">
                              <input
                                type="tel"
                                value={mpesaPhone[order.orderId] || order.paymentPhone || ""}
                                onChange={(e) => setMpesaPhone((prev) => ({ ...prev, [order.orderId]: e.target.value }))}
                                placeholder="0712345678"
                                className="flex-1 bg-background border border-border px-3 py-2 text-xs focus:outline-none focus:border-primary transition-colors"
                              />
                              <button
                                onClick={() => handleMpesaRetry(order)}
                                disabled={requestingMpesaId === order.orderId}
                                className="px-4 py-2 bg-primary text-primary-foreground text-[10px] tracking-widest uppercase font-bold hover:bg-gold-light disabled:opacity-50"
                              >
                                {requestingMpesaId === order.orderId ? "Sending..." : "Send STK Push"}
                              </button>
                            </div>
                          </div>
                        )}

                        {order.status === "Delivered" && !order.customerDeliveryConfirmed && (
                          <button
                            onClick={() => handleConfirmReceipt(order.orderId)}
                            disabled={confirmingReceiptId === order.orderId}
                            className="inline-flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground text-[10px] tracking-widest uppercase font-bold hover:bg-gold-light disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {confirmingReceiptId === order.orderId ? "Confirming..." : "Confirm Receipt"}
                          </button>
                        )}
                      </motion.div>
                    )}

                    {/* Feedback Prompt for Delivered Orders */}
                    {order.status === "Delivered" && !order.comment && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-6 pt-4 border-t border-primary/20 bg-primary/5 p-4 rounded-sm space-y-3"
                      >
                        <div className="flex items-center gap-2 text-primary">
                          <MessageSquare className="w-4 h-4" />
                          <p className="text-[10px] tracking-widest uppercase font-bold">How was your experience?</p>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex items-center gap-1 px-2">
                            {[1, 2, 3, 4, 5].map((value) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setReviewRatings((prev) => ({ ...prev, [order.orderId]: value }))}
                                className="text-primary transition-transform hover:scale-110"
                                aria-label={`Rate ${value} star${value === 1 ? "" : "s"}`}
                              >
                                <Star className={`w-4 h-4 ${value <= (reviewRatings[order.orderId] || 0) ? "fill-primary" : ""}`} />
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            value={commentText[order.orderId] || ""}
                            onChange={(e) => setCommentText(prev => ({ ...prev, [order.orderId]: e.target.value }))}
                            placeholder="Leave a comment about your order..."
                            className="flex-1 bg-background border border-border px-3 py-2 text-xs focus:outline-none focus:border-primary transition-colors"
                          />
                          <button
                            onClick={() => handleSubmitComment(order.orderId)}
                            disabled={submittingComment === order.orderId}
                            className="px-4 py-2 bg-primary text-primary-foreground text-[10px] tracking-widest uppercase font-bold hover:bg-gold-light disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <Send className="w-3 h-3" />
                            {submittingComment === order.orderId ? "..." : "Send"}
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {order.comment && (
                      <div className="mt-4 pt-4 border-t border-border/40">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Your Feedback</p>
                        {order.reviewRating && (
                          <div className="flex items-center gap-1 mb-2 text-primary">
                            {Array.from({ length: 5 }).map((_, index) => (
                              <Star key={index} className={`w-3.5 h-3.5 ${index < order.reviewRating! ? "fill-primary" : ""}`} />
                            ))}
                          </div>
                        )}
                        <p className="text-xs italic font-serif">"{order.comment}"</p>
                      </div>
                    )}

                    {/* Simple Progress Bar for each order in dashboard */}
                    {order.status !== "Delivered" && order.status !== "Cancelled" && (
                      <div className="mt-6 pt-4 border-t border-border/40">
                        <div className="flex justify-between text-[8px] uppercase tracking-widest font-bold mb-2 text-muted-foreground">
                          <span>Processing</span>
                          <span>Shipped</span>
                          <span>Out for Delivery</span>
                        </div>
                        <div className="h-1 bg-border rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ 
                              width: order.status === "Pending" ? "10%" :
                                     order.status === "Processing" ? "33%" :
                                     order.status === "Shipped" ? "66%" : "90%"
                            }}
                            className="h-full bg-primary"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
