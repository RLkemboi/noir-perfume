import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Package, MapPin, CheckCircle, Truck, User, LogOut, ArrowLeft, Phone } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import type { Order } from "../../server/types";

function getOrderDate(order: Order) {
  const candidate =
    order.adminDeliveryConfirmedAt ||
    order.customerDeliveryConfirmedAt ||
    order.agentDeliveryConfirmedAt ||
    order.createdAt;

  return candidate ? new Date(candidate) : null;
}

export default function AgentDashboard() {
  const { profile, getIdToken, logout } = useAuth();
  const navigate = useNavigate();
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const token = await getIdToken();
      if (!token) return;

      const [availableRes, myRes] = await Promise.all([
        fetch("/api/staff/available-orders", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/staff/my-deliveries", { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (availableRes.ok) {
        const data = await availableRes.json();
        setAvailableOrders(data.orders);
      }
      if (myRes.ok) {
        const data = await myRes.json();
        setMyOrders(data.orders);
      }
    } catch {
      toast.error("Failed to load delivery data");
    }
  }, [getIdToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const handleAccept = async (orderId: number) => {
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/staff/orders/${orderId}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success("Order accepted for delivery");
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to accept order");
      }
    } catch {
      toast.error("An error occurred");
    }
  };

  const handleConfirmDelivery = async (orderId: number) => {
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/staff/orders/${orderId}/deliver`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success("Order marked as delivered.");
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to confirm delivery");
      }
    } catch {
      toast.error("An error occurred");
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

  if (profile?.role !== "DeliveryAgent") {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <p className="text-muted-foreground font-serif italic">Access Denied. Delivery Agents Only.</p>
      </div>
    );
  }

  const pendingDeliveries = availableOrders;
  const acceptedDeliveries = myOrders.filter(
    (order) => !order.adminDeliveryConfirmed && !order.agentDeliveryConfirmed && order.status !== "Cancelled"
  );
  const awaitingCustomerConfirmation = myOrders.filter(
    (order) =>
      !order.adminDeliveryConfirmed &&
      !!order.agentDeliveryConfirmed &&
      !order.customerDeliveryConfirmed &&
      order.status !== "Cancelled"
  );
  const completedDeliveries = myOrders.filter((order) => order.adminDeliveryConfirmed && order.status !== "Cancelled");
  const now = new Date();
  const completedThisMonth = completedDeliveries.filter((order) => {
    const completedAt = getOrderDate(order);
    return (
      completedAt &&
      completedAt.getFullYear() === now.getFullYear() &&
      completedAt.getMonth() === now.getMonth()
    );
  });
  const deliveriesPerDay = completedDeliveries.reduce<Record<string, number>>((acc, order) => {
    const completedAt = getOrderDate(order);
    if (!completedAt || Number.isNaN(completedAt.getTime())) return acc;

    const key = completedAt.toLocaleDateString("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const deliveriesPerDayEntries = Object.entries(deliveriesPerDay).sort(([a], [b]) => b.localeCompare(a));

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-4">
      <div className="container mx-auto max-w-4xl space-y-10">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold gold-text">Agent Dashboard</h1>
            <p className="text-muted-foreground text-sm">Welcome back, {profile.email}</p>
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
            <span className="text-[10px] bg-primary/10 text-primary px-3 py-1 rounded-full font-bold tracking-widest uppercase">
              {profile.role}
            </span>
          </div>
        </header>

        {/* Pending Deliveries */}
        <section className="space-y-4">
          <h2 className="font-serif text-xl font-bold flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" /> Pending Deliveries
          </h2>
          {pendingDeliveries.length === 0 ? (
            <div className="glass-panel p-8 text-center text-muted-foreground italic text-sm">
              No deliveries are currently waiting for pickup.
            </div>
          ) : (
            <div className="grid gap-3">
              {pendingDeliveries.map(order => (
                <div key={order.orderId} className="glass-panel p-4 flex justify-between items-center gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] text-primary font-bold tracking-widest uppercase">Order #{order.orderId}</p>
                    <p className="text-sm font-bold">{order.shipping?.city}, {order.shipping?.country}</p>
                    <p className="text-[10px] text-muted-foreground">{order.items.length} items • ${order.total.toFixed(2)}</p>
                  </div>
                  <button
                    onClick={() => handleAccept(order.orderId)}
                    className="px-4 py-2 bg-secondary text-foreground text-[10px] tracking-widest uppercase font-bold hover:bg-primary hover:text-primary-foreground transition-all"
                  >
                    Accept Task
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Accepted Deliveries */}
        <section className="space-y-4">
          <h2 className="font-serif text-xl font-bold flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" /> Accepted Deliveries
          </h2>
          {acceptedDeliveries.length === 0 ? (
            <div className="glass-panel p-8 text-center text-muted-foreground italic text-sm">
              No accepted deliveries in progress.
            </div>
          ) : (
            <div className="grid gap-4">
              {acceptedDeliveries.map(order => (
                <motion.div layout key={order.orderId} className="glass-panel p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-xs text-primary font-bold tracking-widest uppercase">Order #{order.orderId}</p>
                      <p className="text-lg font-bold flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" /> {order.shipping?.fullName}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary" /> {order.shipping?.address}, {order.shipping?.city}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded font-bold uppercase">
                        {order.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 pt-4 border-t border-border/40">
                    {order.status === "Out for Delivery" ? (
                      <button 
                        onClick={() => handleConfirmDelivery(order.orderId)}
                        className="flex-1 py-3 bg-primary text-primary-foreground text-[10px] tracking-widest uppercase font-bold hover:bg-gold-light transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Confirm Delivery
                      </button>
                    ) : (
                      <div className="flex-1 py-3 border border-border text-muted-foreground text-[10px] tracking-widest uppercase font-bold flex items-center justify-center gap-2">
                        {order.customerDeliveryConfirmed ? "Customer Confirmed" : "Awaiting Customer Confirmation"}
                      </div>
                    )}
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${order.shipping?.address}, ${order.shipping?.city}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-3 border border-border text-muted-foreground text-[10px] tracking-widest uppercase font-bold hover:text-foreground transition-colors flex items-center justify-center"
                    >
                      Map
                    </a>
                    {order.shipping?.phone && (
                      <a
                        href={`tel:${order.shipping.phone}`}
                        className="px-5 py-3 border border-border text-muted-foreground text-[10px] tracking-widest uppercase font-bold hover:text-foreground transition-colors flex items-center justify-center gap-2"
                      >
                        <Phone className="w-3 h-3" /> Call Customer
                      </a>
                    )}
                  </div>
                  <div className="grid gap-2 md:grid-cols-3 text-[10px] tracking-widest uppercase font-bold">
                    <div className={`rounded px-3 py-2 ${order.agentDeliveryConfirmed ? "bg-emerald-500/10 text-emerald-500" : "bg-yellow-500/10 text-yellow-500"}`}>
                      Agent: {order.agentDeliveryConfirmed ? "Confirmed" : "Pending"}
                    </div>
                    <div className={`rounded px-3 py-2 ${order.customerDeliveryConfirmed ? "bg-emerald-500/10 text-emerald-500" : "bg-yellow-500/10 text-yellow-500"}`}>
                      Customer: {order.customerDeliveryConfirmed ? "Confirmed" : "Pending"}
                    </div>
                    <div className={`rounded px-3 py-2 ${order.adminDeliveryConfirmed ? "bg-emerald-500/10 text-emerald-500" : "bg-secondary text-muted-foreground"}`}>
                      Admin: {order.adminDeliveryConfirmed ? "Finalized" : "Pending"}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Awaiting Customer Confirmation */}
        <section className="space-y-4">
          <h2 className="font-serif text-xl font-bold flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-primary" /> Awaiting Confirmation of Customer Delivery
          </h2>
          {awaitingCustomerConfirmation.length === 0 ? (
            <div className="glass-panel p-8 text-center text-muted-foreground italic text-sm">
              No deliveries are waiting on customer confirmation.
            </div>
          ) : (
            <div className="grid gap-4">
              {awaitingCustomerConfirmation.map(order => (
                <motion.div layout key={order.orderId} className="glass-panel p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-xs text-primary font-bold tracking-widest uppercase">Order #{order.orderId}</p>
                      <p className="text-lg font-bold flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" /> {order.shipping?.fullName}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary" /> {order.shipping?.address}, {order.shipping?.city}
                      </p>
                    </div>
                    <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded font-bold uppercase">
                      Waiting on Customer
                    </span>
                  </div>

                  <div className="grid gap-2 md:grid-cols-3 text-[10px] tracking-widest uppercase font-bold pt-4 border-t border-border/40">
                    <div className="rounded px-3 py-2 bg-emerald-500/10 text-emerald-500">
                      Agent: Confirmed
                    </div>
                    <div className="rounded px-3 py-2 bg-yellow-500/10 text-yellow-500">
                      Customer: Pending
                    </div>
                    <div className="rounded px-3 py-2 bg-secondary text-muted-foreground">
                      Admin: Pending
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Completed Delivery Stats */}
        <section className="space-y-4">
          <h2 className="font-serif text-xl font-bold flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-primary" /> Confirmed Monthly and Lifetime Completed Deliveries
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass-panel p-6 space-y-2">
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-bold">Monthly Completed</p>
              <p className="font-serif text-4xl font-bold gold-text">{completedThisMonth.length}</p>
              <p className="text-sm text-muted-foreground">Admin-finalized deliveries for the current month.</p>
            </div>
            <div className="glass-panel p-6 space-y-2">
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-bold">Lifetime Completed</p>
              <p className="font-serif text-4xl font-bold gold-text">{completedDeliveries.length}</p>
              <p className="text-sm text-muted-foreground">All admin-finalized deliveries assigned to this agent.</p>
            </div>
          </div>
        </section>

        {/* Deliveries Per Day */}
        <section className="space-y-4">
          <h2 className="font-serif text-xl font-bold flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" /> Deliveries Per Day
          </h2>
          {deliveriesPerDayEntries.length === 0 ? (
            <div className="glass-panel p-8 text-center text-muted-foreground italic text-sm">
              No finalized deliveries available for daily totals yet.
            </div>
          ) : (
            <div className="grid gap-3">
              {deliveriesPerDayEntries.map(([date, count]) => (
                <div key={date} className="glass-panel p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold">Delivery Date</p>
                    <p className="text-sm font-bold">{date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold">Completed</p>
                    <p className="font-serif text-2xl font-bold gold-text">{count}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
