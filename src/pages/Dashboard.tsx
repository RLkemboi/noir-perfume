import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogOut, Package, User, ShoppingBag, Clock, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";
import type { Order } from "../../server/types";

export default function Dashboard() {
  const { user, logout, isGuest, getIdToken, loading: authLoading } = useAuth();
  const { sessionId } = useCart();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

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
    await logout();
    navigate("/");
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

  const displayName = user?.email || "Guest";
  const isMember = !!user;

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
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 border border-border text-muted-foreground text-xs tracking-widest uppercase font-bold hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <LogOut className="w-4 h-4" /> {user ? "Sign Out" : "End Session"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="glass-panel p-6 text-center">
              <ShoppingBag className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-serif font-bold">{orders.length}</p>
              <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold">Orders</p>
            </div>
            <div className="glass-panel p-6 text-center">
              <Clock className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-serif font-bold">
                {orders.filter((o) => o.createdAt && new Date(o.createdAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000).length}
              </p>
              <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold">This Week</p>
            </div>
            <div className="glass-panel p-6 text-center">
              {isMember ? (
                <>
                  <Sparkles className="w-6 h-6 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-serif font-bold">Member</p>
                  <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold">Status</p>
                </>
              ) : (
                <>
                  <User className="w-6 h-6 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-serif font-bold">Guest</p>
                  <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold">Status</p>
                </>
              )}
            </div>
          </div>

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
              <div className="space-y-3">
                {orders.map((order) => (
                  <div
                    key={order.orderId}
                    className="flex items-center justify-between p-4 border border-border hover:border-primary/30 transition-colors"
                  >
                    <div>
                      <p className="text-xs text-primary/60 tracking-widest uppercase font-bold">
                        Order #{order.orderId}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-serif gold-text font-bold">${order.total.toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ""}
                      </p>
                    </div>
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
