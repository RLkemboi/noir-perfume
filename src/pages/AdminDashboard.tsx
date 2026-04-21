import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Shield, UserCheck, UserX, Clock, Mail, ShieldAlert, 
  Package, TrendingUp, Users, ChevronDown, ArrowLeft,
  LayoutDashboard, LogOut, DollarSign, Wallet, Receipt, CreditCard, Star, Activity, Terminal
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import type { UserProfile, Order, OrderStatus } from "../../server/types";
import { TierBadge } from "@/components/ui/TierBadge";

interface FinancialWeek {
  label: string;
  bookedRevenue: number;
  realizedRevenue: number;
  estimatedProfit: number;
  netWorth: number;
  direction: "up" | "down" | "flat";
}

interface FinancialSummary {
  totalRevenue: number;
  orderCount: number;
  bookedRevenue: number;
  realizedRevenue: number;
  cancelledRevenue: number;
  outstandingCod: number;
  openPipelineRevenue: number;
  estimatedGrossProfit: number;
  operatingNetWorth: number;
  averageOrderValue: number;
  grossMargin: number;
  deliveryCompletionRate: number;
  activeOrders: number;
  deliveredOrders: number;
  unitsSold: number;
  payOnDeliveryOrders: number;
  unpaidCodOrders: number;
  partialCodOrders: number;
  paidCodOrders: number;
  promptRequestedOrders: number;
  cardOrders: number;
  ratedOrders: number;
  averageReviewRating: number;
  recentSales: Order[];
  weeklyTrend: FinancialWeek[];
}

const statusColors: Record<OrderStatus, string> = {
  "Pending": "text-yellow-500 border-yellow-500/20 bg-yellow-500/5",
  "Processing": "text-blue-500 border-blue-500/20 bg-blue-500/5",
  "Shipped": "text-purple-500 border-purple-500/20 bg-purple-500/5",
  "Out for Delivery": "text-orange-500 border-orange-500/20 bg-orange-500/5",
  "Delivered": "text-emerald-500 border-emerald-500/20 bg-emerald-500/5",
  "Cancelled": "text-red-500 border-red-500/20 bg-red-500/5",
};

const statusOptions: OrderStatus[] = ["Pending", "Processing", "Shipped", "Cancelled"];

function getConfirmationState(order: Order) {
  const confirmations = Number(!!order.agentDeliveryConfirmed) + Number(!!order.customerDeliveryConfirmed);
  if (confirmations === 2) {
    return {
      label: order.adminDeliveryConfirmed ? "Finalized" : "Both Confirmed",
      className: "text-emerald-500 border-emerald-500/20 bg-emerald-500/5",
    };
  }
  if (confirmations === 1) {
    return {
      label: "One Side Confirmed",
      className: "text-red-500 border-red-500/20 bg-red-500/5",
    };
  }
  return {
    label: "Awaiting Both",
    className: "text-yellow-500 border-yellow-500/20 bg-yellow-500/5",
  };
}

export default function AdminDashboard() {
  const { profile, getIdToken, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"overview" | "finance" | "orders" | "staff" | "logs">("overview");
  
  // Staff State
  const [pendingStaff, setPendingStaff] = useState<UserProfile[]>([]);
  const [staffDirectory, setStaffDirectory] = useState<UserProfile[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [savingStaffId, setSavingStaffId] = useState<string | null>(null);
  
  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [financials, setFinancials] = useState<FinancialSummary | null>(null);

  // System Logs State
  const [systemLogs, setSystemLogs] = useState<{id: string, timestamp: string, level: string, message: string, source: string}[]>([]);

  // Fetch Data
  const fetchData = useCallback(async () => {
    if (profile?.role !== "Admin") return;
    
    setLoadingStaff(true);
    setLoadingOrders(true);
    
    try {
      const token = await getIdToken();
      const [staffRes, staffDirectoryRes, ordersRes, financialRes, logsRes] = await Promise.all([
        fetch("/api/admin/pending-staff", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/staff", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/orders", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/financials", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/system-logs", { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      if (staffRes.ok) {
        const data = await staffRes.json();
        setPendingStaff(data.pending);
      }
      if (staffDirectoryRes.ok) {
        const data = await staffDirectoryRes.json();
        setStaffDirectory(data.staff);
      }
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data.orders);
      }
      if (financialRes.ok) {
        const data = await financialRes.json();
        setFinancials(data);
      }
      if (logsRes.ok) {
        const data = await logsRes.json();
        setSystemLogs(data.logs);
      }
    } catch {
      toast.error("Failed to load admin data");
    } finally {
      setLoadingStaff(false);
      setLoadingOrders(false);
    }
  }, [getIdToken, profile?.role]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Actions
  const handleApproveStaff = async (userId: string) => {
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/admin/approve-staff/${userId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success("Staff approved successfully");
        setPendingStaff(prev => prev.filter(s => s.userId !== userId));
        setStaffDirectory((prev) => prev.map((staff) => (
          staff.userId === userId
            ? { ...staff, isApproved: true, employmentStatus: "Active" }
            : staff
        )));
      }
    } catch {
      toast.error("Failed to approve staff");
    }
  };

  const handleUpdateStaff = async (
    userId: string,
    updates: Partial<Pick<UserProfile, "role" | "isApproved" | "employmentStatus" | "department" | "hrNotes">>
  ) => {
    setSavingStaffId(userId);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/admin/staff/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to update employee");

      setStaffDirectory((prev) => prev.map((staff) => (staff.userId === userId ? data.profile : staff)));
      setPendingStaff((prev) =>
        data.profile.isApproved ? prev.filter((staff) => staff.userId !== userId) : prev
      );
      toast.success("Employee record updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update employee");
    } finally {
      setSavingStaffId(null);
    }
  };

  const handleUpdateOrderStatus = async (orderId: number, newStatus: OrderStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        const data = await res.json();
        setOrders(prev => prev.map(o => o.orderId === orderId ? data.order : o));
        toast.success(`Order #${orderId} updated to ${newStatus}`);
      } else {
        toast.error("Failed to update order");
      }
    } catch {
      toast.error("Network error. Failed to update order.");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleFinalizeDelivery = async (orderId: number) => {
    setUpdatingOrderId(orderId);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/admin/orders/${orderId}/finalize-delivery`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to finalize delivery");
      }

      setOrders((prev) => prev.map((order) => (order.orderId === orderId ? data.order : order)));
      toast.success(`Delivery #${orderId} finalized`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to finalize delivery";
      toast.error(message);
    } finally {
      setUpdatingOrderId(null);
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

  if (profile?.role !== "Admin") {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-destructive mx-auto" />
          <p className="text-muted-foreground font-serif italic">Access Denied. Administrators Only.</p>
          <button onClick={() => navigate("/")} className="text-primary hover:underline">Return to Home</button>
        </div>
      </div>
    );
  }

  const totalRevenue = financials?.bookedRevenue ?? 0;
  const activeEmployees = staffDirectory.filter((staff) => staff.employmentStatus !== "Suspended" && staff.isApproved);
  const suspendedEmployees = staffDirectory.filter((staff) => staff.employmentStatus === "Suspended");
  const weeklyTrend = financials?.weeklyTrend ?? [];
  const chartValues = weeklyTrend.map((item) => item.estimatedProfit);
  const minValue = Math.min(...chartValues, 0);
  const maxValue = Math.max(...chartValues, 1);
  const valueRange = maxValue - minValue || 1;
  const chartPoints = weeklyTrend.map((item, index) => {
    const x = weeklyTrend.length === 1 ? 50 : (index / (weeklyTrend.length - 1)) * 100;
    const y = 100 - ((item.estimatedProfit - minValue) / valueRange) * 100;
    return { ...item, x, y };
  });
  const linePath = chartPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const formatMoney = (value?: number) => `$${Number(value ?? 0).toFixed(2)}`;

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-4">
      <div className="container mx-auto max-w-6xl space-y-10">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold gold-text flex items-center gap-3">
              <Shield className="w-8 h-8" /> Control Center
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Noir Perfume Global Administration</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="px-4 py-2 border border-border text-muted-foreground text-[10px] tracking-widest uppercase font-bold hover:text-foreground transition-colors flex items-center gap-2">
              <ArrowLeft className="w-3 h-3" /> Exit to Store
            </Link>
            <button 
              onClick={handleLogout}
              className="px-4 py-2 border border-destructive/20 text-destructive text-[10px] tracking-widest uppercase font-bold hover:bg-destructive/10 transition-colors flex items-center gap-2"
            >
              <LogOut className="w-3 h-3" /> Logout
            </button>
            <span className="text-[10px] bg-primary/10 text-primary px-3 py-2 rounded font-bold tracking-widest uppercase flex items-center gap-2">
              <Shield className="w-3 h-3" /> Super Admin
            </span>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="flex border-b border-border gap-6">
          <button 
            onClick={() => setActiveTab("overview")}
            className={`pb-4 text-xs tracking-widest uppercase font-bold transition-all relative ${activeTab === "overview" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <span className="flex items-center gap-2"><LayoutDashboard className="w-4 h-4" /> Overview</span>
            {activeTab === "overview" && <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
          <button 
            onClick={() => setActiveTab("orders")}
            className={`pb-4 text-xs tracking-widest uppercase font-bold transition-all relative flex items-center gap-2 ${activeTab === "orders" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <span className="flex items-center gap-2"><Package className="w-4 h-4" /> Orders</span>
            {orders.filter(o => o.status === "Pending").length > 0 && (
              <span className="w-4 h-4 bg-primary text-primary-foreground text-[8px] rounded-full flex items-center justify-center">
                {orders.filter(o => o.status === "Pending").length}
              </span>
            )}
            {activeTab === "orders" && <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
          <button 
            onClick={() => setActiveTab("finance")}
            className={`pb-4 text-xs tracking-widest uppercase font-bold transition-all relative flex items-center gap-2 ${activeTab === "finance" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <span className="flex items-center gap-2"><DollarSign className="w-4 h-4" /> Financials</span>
            {activeTab === "finance" && <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
          <button 
            onClick={() => setActiveTab("staff")}
            className={`pb-4 text-xs tracking-widest uppercase font-bold transition-all relative flex items-center gap-2 ${activeTab === "staff" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <span className="flex items-center gap-2"><Users className="w-4 h-4" /> Staff Portal</span>
            {pendingStaff.length > 0 && (
              <span className="w-4 h-4 bg-primary text-primary-foreground text-[8px] rounded-full flex items-center justify-center">
                {pendingStaff.length}
              </span>
            )}
            {activeTab === "staff" && <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
          <button 
            onClick={() => setActiveTab("logs")}
            className={`pb-4 text-xs tracking-widest uppercase font-bold transition-all relative flex items-center gap-2 ${activeTab === "logs" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <span className="flex items-center gap-2"><Activity className="w-4 h-4" /> System Logs</span>
            {systemLogs.filter(l => l.level === "error" || l.level === "critical").length > 0 && (
              <span className="w-4 h-4 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center">
                {systemLogs.filter(l => l.level === "error" || l.level === "critical").length}
              </span>
            )}
            {activeTab === "logs" && <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <motion.div 
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-panel p-6">
                  <TrendingUp className="w-6 h-6 text-primary mb-4" />
                  <p className="text-3xl font-serif font-bold gold-text">${totalRevenue.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold mt-1">Booked Revenue</p>
                </div>
                <div className="glass-panel p-6">
                  <Wallet className="w-6 h-6 text-emerald-500 mb-4" />
                  <p className="text-3xl font-serif font-bold text-emerald-500">${financials?.realizedRevenue.toFixed(2) ?? "0.00"}</p>
                  <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold mt-1">Realized Cash</p>
                </div>
                <div className="glass-panel p-6">
                  <Receipt className="w-6 h-6 text-yellow-500 mb-4" />
                  <p className="text-3xl font-serif font-bold text-yellow-500">${financials?.openPipelineRevenue.toFixed(2) ?? "0.00"}</p>
                  <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold mt-1">Pipeline Value</p>
                </div>
                <div className="glass-panel p-6">
                  <Clock className="w-6 h-6 text-purple-500 mb-4" />
                  <p className="text-3xl font-serif font-bold text-purple-500">${financials?.estimatedGrossProfit.toFixed(2) ?? "0.00"}</p>
                  <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold mt-1">Estimated Gross Profit</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Recent Activity Mini-Feed */}
                <div className="glass-panel p-6">
                  <h3 className="text-sm font-bold tracking-widest uppercase mb-4 text-primary">Revenue Health</h3>
                  <div className="space-y-4">
                      {[
                        { label: "Average Order Value", value: `$${financials?.averageOrderValue.toFixed(2) ?? "0.00"}` },
                        { label: "Gross Margin", value: `${financials?.grossMargin.toFixed(1) ?? "0.0"}%` },
                        { label: "COD Exposure", value: `$${financials?.outstandingCod.toFixed(2) ?? "0.00"}` },
                        { label: "Cancelled Revenue", value: `$${financials?.cancelledRevenue.toFixed(2) ?? "0.00"}` },
                        { label: "Units Sold", value: `${financials?.unitsSold ?? 0}` },
                      ].map((metric) => (
                      <div key={metric.label} className="flex justify-between items-center pb-4 border-b border-border/40 last:border-0 last:pb-0">
                        <div>
                          <p className="text-xs font-bold">{metric.label}</p>
                          <p className="text-[10px] text-muted-foreground">Operational finance KPI</p>
                        </div>
                        <p className="text-xs font-bold font-serif gold-text">{metric.value}</p>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setActiveTab("finance")} className="w-full mt-6 py-3 border border-border text-xs tracking-widest uppercase font-bold hover:bg-primary/5 transition-colors">
                    Open Financials
                  </button>
                </div>

                {/* Quick Staff Mini-Feed */}
                <div className="glass-panel p-6">
                  <h3 className="text-sm font-bold tracking-widest uppercase mb-4 text-primary">Customer Signal</h3>
                  <div className="space-y-4">
                    {[
                      { label: "Average Review Rating", value: `${financials?.averageReviewRating.toFixed(1) ?? "0.0"} / 5`, icon: Star },
                      { label: "Rated Delivered Orders", value: `${financials?.ratedOrders ?? 0}`, icon: Package },
                      { label: "Delivery Completion", value: `${financials?.deliveryCompletionRate.toFixed(1) ?? "0.0"}%`, icon: TrendingUp },
                      { label: "Pending Staff Approvals", value: `${pendingStaff.length}`, icon: Users },
                    ].map((item) => (
                      <div key={item.label} className="flex justify-between items-center pb-4 border-b border-border/40 last:border-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary font-bold">
                            <item.icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold">{item.label}</p>
                            <p className="text-[10px] text-muted-foreground tracking-widest uppercase">Brand trust</p>
                          </div>
                        </div>
                        <p className="text-xs font-bold font-serif gold-text">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setActiveTab("staff")} className="w-full mt-6 py-3 border border-border text-xs tracking-widest uppercase font-bold hover:bg-primary/5 transition-colors">
                    Manage Staff
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "finance" && (
            <motion.div
              key="finance"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-panel p-6">
                  <DollarSign className="w-6 h-6 text-primary mb-4" />
                  <p className="text-3xl font-serif font-bold gold-text">{formatMoney(financials?.operatingNetWorth)}</p>
                  <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold mt-1">Net Worth Proxy</p>
                </div>
                <div className="glass-panel p-6">
                  <Wallet className="w-6 h-6 text-emerald-500 mb-4" />
                  <p className="text-3xl font-serif font-bold text-emerald-500">{formatMoney(financials?.realizedRevenue)}</p>
                  <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold mt-1">Realized Revenue</p>
                </div>
                <div className="glass-panel p-6">
                  <CreditCard className="w-6 h-6 text-amber-500 mb-4" />
                  <p className="text-3xl font-serif font-bold text-amber-500">{financials?.payOnDeliveryOrders ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold mt-1">COD Orders</p>
                </div>
                <div className="glass-panel p-6">
                  <Receipt className="w-6 h-6 text-red-500 mb-4" />
                  <p className="text-3xl font-serif font-bold text-red-500">{formatMoney(financials?.cancelledRevenue)}</p>
                  <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold mt-1">Revenue Lost</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass-panel p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold tracking-widest uppercase text-primary">Weekly Profit Movement</h3>
                      <p className="text-xs text-muted-foreground">Estimated gross profit trend with operating net worth overlays.</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Current Net Worth Proxy</p>
                      <p className="font-serif text-xl gold-text font-bold">{formatMoney(financials?.operatingNetWorth)}</p>
                    </div>
                  </div>

                  <div className="h-72 w-full rounded border border-border/60 bg-black/10 p-4">
                    {chartPoints.length > 0 ? (
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                        {chartPoints.slice(1).map((point, index) => {
                          const prev = chartPoints[index];
                          return (
                            <line
                              key={`${point.label}-${index}`}
                              x1={prev.x}
                              y1={prev.y}
                              x2={point.x}
                              y2={point.y}
                              stroke={point.direction === "down" ? "#ef4444" : "#22c55e"}
                              strokeWidth="1.5"
                            />
                          );
                        })}
                        <path d={linePath} fill="none" stroke="rgba(212,175,55,0.5)" strokeWidth="0.4" />
                        {chartPoints.map((point) => (
                          <circle
                            key={point.label}
                            cx={point.x}
                            cy={point.y}
                            r="2.1"
                            fill={point.direction === "down" ? "#ef4444" : point.direction === "up" ? "#22c55e" : "#eab308"}
                          />
                        ))}
                      </svg>
                    ) : (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No weekly financial trend yet.</div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {weeklyTrend.map((week) => (
                      <div key={week.label} className={`rounded border px-3 py-3 ${week.direction === "down" ? "border-red-500/20 bg-red-500/5" : week.direction === "up" ? "border-emerald-500/20 bg-emerald-500/5" : "border-yellow-500/20 bg-yellow-500/5"}`}>
                        <p className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground">{week.label}</p>
                        <p className="font-serif font-bold">{formatMoney(week.estimatedProfit)}</p>
                        <p className="text-[10px] text-muted-foreground">Net worth {formatMoney(week.netWorth)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-panel p-6 space-y-5">
                  <h3 className="text-sm font-bold tracking-widest uppercase text-primary">Financial Breakdown</h3>
                  {[
                    { label: "Booked Revenue", value: financials?.bookedRevenue ?? 0 },
                    { label: "Open COD Exposure", value: financials?.outstandingCod ?? 0 },
                    { label: "Pipeline Revenue", value: financials?.openPipelineRevenue ?? 0 },
                    { label: "Gross Profit", value: financials?.estimatedGrossProfit ?? 0 },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between items-center border-b border-border/40 pb-3 last:border-0 last:pb-0">
                      <span className="text-xs font-bold">{item.label}</span>
                      <span className="font-serif gold-text font-bold">{formatMoney(item.value)}</span>
                    </div>
                  ))}

                  <div className="pt-4 border-t border-border/40 space-y-3">
                    <p className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Business Notes</p>
                    <p className="text-xs text-muted-foreground">Booked revenue shows demand. Realized revenue shows cash actually secured. COD exposure and cancellations are the first leak points to watch weekly.</p>
                    <p className="text-xs text-muted-foreground">Net worth here is an operating proxy based on orders and estimated gross profit, not a full audited balance sheet.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-panel p-5">
                  <p className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Unpaid COD</p>
                  <p className="mt-2 text-2xl font-serif font-bold text-yellow-500">{financials?.unpaidCodOrders ?? 0}</p>
                </div>
                <div className="glass-panel p-5">
                  <p className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Bronze Deposit Orders</p>
                  <p className="mt-2 text-2xl font-serif font-bold text-primary">{financials?.partialCodOrders ?? 0}</p>
                </div>
                <div className="glass-panel p-5">
                  <p className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Paid COD</p>
                  <p className="mt-2 text-2xl font-serif font-bold text-emerald-500">{financials?.paidCodOrders ?? 0}</p>
                </div>
                <div className="glass-panel p-5">
                  <p className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Prompt Requests</p>
                  <p className="mt-2 text-2xl font-serif font-bold text-red-500">{financials?.promptRequestedOrders ?? 0}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ORDERS TAB */}
          {activeTab === "orders" && (
            <motion.div 
              key="orders"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="glass-panel overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border bg-black/20">
                        <th className="px-6 py-4 text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Order ID</th>
                        <th className="px-6 py-4 text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Customer</th>
                        <th className="px-6 py-4 text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Date</th>
                        <th className="px-6 py-4 text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Total</th>
                        <th className="px-6 py-4 text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Status</th>
                        <th className="px-6 py-4 text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Payment</th>
                        <th className="px-6 py-4 text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Customer Note</th>
                        <th className="px-6 py-4 text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Confirmations</th>
                        <th className="px-6 py-4 text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Admin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {loadingOrders ? (
                        <tr><td colSpan={9} className="px-6 py-8 text-center text-sm">Loading orders...</td></tr>
                      ) : orders.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground italic font-serif">
                            No orders found in the system.
                          </td>
                        </tr>
                      ) : (
                        orders.slice().reverse().map((order) => (
                          <tr key={order.orderId} className="hover:bg-primary/5 transition-colors">
                            <td className="px-6 py-4">
                              <span className="text-xs font-mono font-bold text-primary">#{order.orderId}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold">{order.shipping?.fullName || "N/A"}</span>
                                <span className="text-[10px] text-muted-foreground">{order.userEmail || order.shipping?.email || "Guest"}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs text-muted-foreground">
                                {new Date(order.createdAt).toLocaleDateString()}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm font-serif font-bold gold-text">${order.total.toFixed(2)}</span>
                            </td>
                            <td className="px-6 py-4">
                              {statusOptions.includes(order.status) ? (
                                <div className="relative inline-block group">
                                  <select
                                    disabled={updatingOrderId === order.orderId}
                                    value={order.status}
                                    onChange={(e) => handleUpdateOrderStatus(order.orderId, e.target.value as OrderStatus)}
                                    className={`appearance-none px-3 py-1.5 pr-8 rounded-full border text-[10px] tracking-widest uppercase font-bold cursor-pointer transition-all focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50 ${statusColors[order.status] || "text-muted-foreground border-border"}`}
                                  >
                                    {statusOptions.map(opt => (
                                      <option key={opt} value={opt} className="bg-background text-foreground">
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                                </div>
                              ) : (
                                <span className={`inline-flex px-3 py-1.5 rounded-full border text-[10px] tracking-widest uppercase font-bold ${statusColors[order.status]}`}>
                                  {order.status}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="space-y-1">
                                <span className={`inline-flex px-3 py-1.5 rounded-full border text-[10px] tracking-widest uppercase font-bold ${
                                  order.paymentStatus === "Paid"
                                    ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5"
                                    : order.paymentStatus === "Partial"
                                      ? "text-primary border-primary/20 bg-primary/5"
                                      : "text-yellow-500 border-yellow-500/20 bg-yellow-500/5"
                                }`}>
                                  {order.paymentStatus}
                                </span>
                                <p className="text-[10px] text-muted-foreground">
                                  ${order.amountPaid.toFixed(2)} / ${order.total.toFixed(2)}
                                </p>
                              </div>
                            </td>
                            <td className="px-6 py-4 max-w-xs">
                              {order.comment ? (
                                <div className="space-y-1">
                                  {order.reviewRating ? (
                                    <div className="flex items-center gap-1 text-primary">
                                      {Array.from({ length: 5 }).map((_, index) => (
                                        <Star key={index} className={`w-3 h-3 ${index < order.reviewRating! ? "fill-primary" : ""}`} />
                                      ))}
                                    </div>
                                  ) : null}
                                  <p className="text-xs text-muted-foreground">"{order.comment}"</p>
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">No customer note yet</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {(() => {
                                const confirmationState = getConfirmationState(order);
                                return (
                                  <div className={`inline-flex px-3 py-1.5 rounded-full border text-[10px] tracking-widest uppercase font-bold ${confirmationState.className}`}>
                                    {confirmationState.label}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-6 py-4">
                              <button
                                disabled={updatingOrderId === order.orderId || order.adminDeliveryConfirmed || !order.agentDeliveryConfirmed || !order.customerDeliveryConfirmed || order.amountDue > 0}
                                onClick={() => handleFinalizeDelivery(order.orderId)}
                                className="px-3 py-1.5 border border-border text-[10px] tracking-widest uppercase font-bold text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-50"
                              >
                                {order.adminDeliveryConfirmed ? "Finalized" : order.amountDue > 0 ? "Await Payment" : "Confirm Both"}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* STAFF TAB */}
          {activeTab === "staff" && (
            <motion.div 
              key="staff"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {loadingStaff ? (
                <div className="text-center py-20">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground text-xs tracking-widest uppercase">Loading employee records...</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="glass-panel p-6">
                      <Users className="w-6 h-6 text-primary mb-4" />
                      <p className="text-3xl font-serif font-bold gold-text">{staffDirectory.length}</p>
                      <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold mt-1">Total Staff</p>
                    </div>
                    <div className="glass-panel p-6">
                      <UserCheck className="w-6 h-6 text-emerald-500 mb-4" />
                      <p className="text-3xl font-serif font-bold text-emerald-500">{activeEmployees.length}</p>
                      <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold mt-1">Active Employees</p>
                    </div>
                    <div className="glass-panel p-6">
                      <UserX className="w-6 h-6 text-red-500 mb-4" />
                      <p className="text-3xl font-serif font-bold text-red-500">{suspendedEmployees.length}</p>
                      <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold mt-1">Suspended</p>
                    </div>
                  </div>

                  <div className="glass-panel p-6 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-bold tracking-widest uppercase text-primary">Pending Applications</h3>
                        <p className="text-xs text-muted-foreground">Approve or hold incoming staff requests.</p>
                      </div>
                      <span className="text-xs font-bold">{pendingStaff.length}</span>
                    </div>

                    {pendingStaff.length === 0 ? (
                      <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-muted-foreground">
                        No pending staff applications.
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {pendingStaff.map((staff) => (
                          <motion.div
                            layout
                            key={staff.userId}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="rounded border border-primary/10 bg-black/10 p-4 flex flex-col md:flex-row justify-between gap-4"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <p className="font-bold">{staff.email}</p>
                                <span className="text-[8px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold uppercase tracking-widest">
                                  {staff.role}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">Joined {new Date(staff.joinedAt).toLocaleDateString()}</p>
                              <TierBadge tier={staff.tier} className="scale-75 origin-left" />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproveStaff(staff.userId)}
                                className="px-4 py-2 bg-primary text-primary-foreground text-[10px] tracking-widest uppercase font-bold hover:bg-gold-light transition-all"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleUpdateStaff(staff.userId, { isApproved: false, employmentStatus: "Suspended" })}
                                className="px-4 py-2 border border-border text-muted-foreground text-[10px] tracking-widest uppercase font-bold hover:text-destructive hover:border-destructive/40 transition-all"
                              >
                                Hold
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="glass-panel overflow-hidden">
                    <div className="px-6 py-4 border-b border-border bg-black/20 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-bold tracking-widest uppercase text-primary">Employee Directory</h3>
                        <p className="text-xs text-muted-foreground">HR controls for role assignment, approval, and suspension.</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-border bg-black/10">
                            <th className="px-6 py-4 text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Employee</th>
                            <th className="px-6 py-4 text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Role</th>
                            <th className="px-6 py-4 text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Department</th>
                            <th className="px-6 py-4 text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Status</th>
                            <th className="px-6 py-4 text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Approval</th>
                            <th className="px-6 py-4 text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {staffDirectory.map((staff) => (
                            <tr key={staff.userId} className="hover:bg-primary/5 transition-colors">
                              <td className="px-6 py-4">
                                <div className="space-y-1">
                                  <p className="text-sm font-bold">{staff.email}</p>
                                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Mail className="w-3 h-3" /> Joined {new Date(staff.joinedAt).toLocaleDateString()}
                                  </p>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <select
                                  disabled={savingStaffId === staff.userId}
                                  value={staff.role}
                                  onChange={(e) => handleUpdateStaff(staff.userId, { role: e.target.value as UserProfile["role"] })}
                                  className="bg-background border border-border px-3 py-2 text-[10px] tracking-widest uppercase font-bold"
                                >
                                  {(["Admin", "Manager", "Operator", "DeliveryAgent", "Marketing"] as UserProfile["role"][]).map((role) => (
                                    <option key={role} value={role}>{role}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-6 py-4">
                                <button
                                  onClick={() => {
                                    const nextDepartment = window.prompt("Department", staff.department || "General");
                                    if (nextDepartment !== null) {
                                      void handleUpdateStaff(staff.userId, { department: nextDepartment });
                                    }
                                  }}
                                  className="text-xs text-muted-foreground hover:text-foreground"
                                >
                                  {staff.department || "Set Department"}
                                </button>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex px-3 py-1.5 rounded-full border text-[10px] tracking-widest uppercase font-bold ${
                                  staff.employmentStatus === "Suspended"
                                    ? "text-red-500 border-red-500/20 bg-red-500/5"
                                    : staff.isApproved
                                      ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5"
                                      : "text-yellow-500 border-yellow-500/20 bg-yellow-500/5"
                                }`}>
                                  {staff.employmentStatus || (staff.isApproved ? "Active" : "PendingApproval")}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`text-[10px] tracking-widest uppercase font-bold ${staff.isApproved ? "text-emerald-500" : "text-yellow-500"}`}>
                                  {staff.isApproved ? "Approved" : "Pending"}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-wrap gap-2">
                                  {!staff.isApproved && (
                                    <button
                                      onClick={() => handleApproveStaff(staff.userId)}
                                      disabled={savingStaffId === staff.userId}
                                      className="px-3 py-1.5 bg-primary text-primary-foreground text-[10px] tracking-widest uppercase font-bold disabled:opacity-50"
                                    >
                                      Approve
                                    </button>
                                  )}
                                  {staff.employmentStatus === "Suspended" ? (
                                    <button
                                      onClick={() => handleUpdateStaff(staff.userId, { employmentStatus: "Active", isApproved: true })}
                                      disabled={savingStaffId === staff.userId}
                                      className="px-3 py-1.5 border border-emerald-500/30 text-emerald-500 text-[10px] tracking-widest uppercase font-bold disabled:opacity-50"
                                    >
                                      Restore
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleUpdateStaff(staff.userId, { employmentStatus: "Suspended", isApproved: false })}
                                      disabled={savingStaffId === staff.userId}
                                      className="px-3 py-1.5 border border-red-500/30 text-red-500 text-[10px] tracking-widest uppercase font-bold disabled:opacity-50"
                                    >
                                      Suspend
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      const nextNotes = window.prompt("HR notes", staff.hrNotes || "");
                                      if (nextNotes !== null) {
                                        void handleUpdateStaff(staff.userId, { hrNotes: nextNotes });
                                      }
                                    }}
                                    disabled={savingStaffId === staff.userId}
                                    className="px-3 py-1.5 border border-border text-muted-foreground text-[10px] tracking-widest uppercase font-bold disabled:opacity-50"
                                  >
                                    Notes
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
          {/* LOGS TAB */}
          {activeTab === "logs" && (
            <motion.div 
              key="logs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="glass-panel p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-sm font-bold tracking-widest uppercase text-primary">System Logs</h3>
                    <p className="text-xs text-muted-foreground">Monitor critical system events and database connection statuses.</p>
                  </div>
                  <button onClick={fetchData} className="px-4 py-2 bg-primary/10 text-primary text-[10px] tracking-widest uppercase font-bold hover:bg-primary/20 transition-all">
                    Refresh Logs
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border bg-black/20">
                        <th className="px-6 py-4 text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Time</th>
                        <th className="px-6 py-4 text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Severity</th>
                        <th className="px-6 py-4 text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Source</th>
                        <th className="px-6 py-4 text-[10px] tracking-widest uppercase font-bold text-muted-foreground">Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {systemLogs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground italic font-serif">
                            No system logs recorded.
                          </td>
                        </tr>
                      ) : (
                        systemLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-primary/5 transition-colors">
                            <td className="px-6 py-4 text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-3 py-1 rounded-full border text-[10px] tracking-widest uppercase font-bold ${
                                log.level === "error" || log.level === "critical" 
                                  ? "text-red-500 border-red-500/20 bg-red-500/5"
                                  : log.level === "warning"
                                    ? "text-yellow-500 border-yellow-500/20 bg-yellow-500/5"
                                    : "text-emerald-500 border-emerald-500/20 bg-emerald-500/5"
                              }`}>
                                <Terminal className="w-3 h-3 inline-block mr-1" />
                                {log.level}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-mono text-xs font-bold text-primary">
                              {log.source}
                            </td>
                            <td className="px-6 py-4 text-xs font-mono text-muted-foreground">
                              {log.message}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
