import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Package, Clock, CheckCircle2, ChevronRight, Filter, Truck, LogOut, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import type { Order } from "../../server/types";

export default function OperatorDashboard() {
  const { getIdToken, logout, profile } = useAuth();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const fetchQueue = async () => {
    try {
      const token = await getIdToken();
      const res = await fetch("/api/operator/queue", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setQueue(data.orders);
      }
    } catch {
      toast.error("Failed to load processing queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleAdvance = async (orderId: number) => {
    setProcessingId(orderId);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/orders/${orderId}/advance`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success("Order moved to next stage");
        fetchQueue();
      }
    } catch {
      toast.error("Process update failed");
    } finally {
      setProcessingId(null);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
      toast.success("Logged out successfully");
    } catch {
      toast.error("Logout failed");
    }
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-4">
      <div className="container mx-auto max-w-5xl space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold gold-text flex items-center gap-3">
              <Package className="w-8 h-8" /> Logistics Queue
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Pending and In-Processing fulfillment</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="px-4 py-2 border border-border text-muted-foreground text-[10px] tracking-widest uppercase font-bold hover:text-foreground transition-colors flex items-center gap-2">
              <ArrowLeft className="w-3 h-3" /> Dashboard
            </Link>
            <button 
              onClick={handleLogout}
              className="px-4 py-2 border border-destructive/20 text-destructive text-[10px] tracking-widest uppercase font-bold hover:bg-destructive/10 transition-colors flex items-center gap-2"
            >
              <LogOut className="w-3 h-3" /> Logout
            </button>
            <span className="text-[10px] bg-primary/10 text-primary px-3 py-2 rounded font-bold tracking-widest uppercase">
              {profile?.role}
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel p-6 border-yellow-500/20 bg-yellow-500/5">
            <Clock className="w-5 h-5 text-yellow-500 mb-2" />
            <p className="text-2xl font-serif font-bold">{queue.filter(o => o.status === "Pending").length}</p>
            <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold">Awaiting Action</p>
          </div>
          <div className="glass-panel p-6 border-blue-500/20 bg-blue-500/5">
            <Filter className="w-5 h-5 text-blue-500 mb-2" />
            <p className="text-2xl font-serif font-bold">{queue.filter(o => o.status === "Processing").length}</p>
            <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold">Currently Packing</p>
          </div>
          <div className="glass-panel p-6 border-emerald-500/20 bg-emerald-500/5">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mb-2" />
            <p className="text-2xl font-serif font-bold">Ready</p>
            <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold">Auto-Ship Enabled</p>
          </div>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-20 italic text-muted-foreground">Syncing logistics data...</div>
          ) : queue.length === 0 ? (
            <div className="glass-panel p-20 text-center text-muted-foreground italic">
              Queue is empty. All orders are currently shipped.
            </div>
          ) : (
            queue.map(order => (
              <motion.div layout key={order.orderId} className="glass-panel p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex gap-4 items-center flex-1">
                  <div className="w-12 h-12 bg-secondary rounded flex items-center justify-center">
                    <Package className="w-6 h-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-primary">ORDER #{order.orderId}</p>
                    <p className="text-sm font-bold">{order.items.length} items • ${order.total.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      {order.shipping?.fullName} • {order.shipping?.city}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 w-full md:w-auto">
                  <div className="text-center md:text-right px-4">
                    <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest border ${
                      order.status === "Pending" ? "border-yellow-500/30 text-yellow-500" : "border-blue-500/30 text-blue-500"
                    }`}>
                      {order.status}
                    </span>
                  </div>
                  
                  <button 
                    disabled={processingId === order.orderId}
                    onClick={() => handleAdvance(order.orderId)}
                    className="flex-1 md:flex-none px-8 py-3 bg-primary text-primary-foreground text-[10px] tracking-widest uppercase font-bold hover:bg-gold-light transition-all flex items-center justify-center gap-2"
                  >
                    {order.status === "Pending" ? (
                      <><ChevronRight className="w-4 h-4" /> Start Processing</>
                    ) : (
                      <><Truck className="w-4 h-4" /> Mark as Shipped</>
                    )}
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
