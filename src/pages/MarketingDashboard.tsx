import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  TrendingUp, Users, DollarSign, ShoppingCart, 
  ArrowUpRight, Sparkles, Crown, LogOut, ArrowLeft
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { TierBadge } from "@/components/ui/TierBadge";

export default function MarketingDashboard() {
  const { getIdToken, logout, profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const token = await getIdToken();
      const res = await fetch("/api/marketing/analytics", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      toast.error("Analytics sync failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
      toast.success("Logged out successfully");
    } catch {
      toast.error("Logout failed");
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Tracing market trends...</div>;

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-4">
      <div className="container mx-auto max-w-6xl space-y-10">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold gold-text flex items-center gap-3">
              <TrendingUp className="w-8 h-8" /> Growth Analytics
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Real-time revenue and tier distribution metrics</p>
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

        {/* High Level Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-panel p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-emerald-500/10 rounded">
                <DollarSign className="w-5 h-5 text-emerald-500" />
              </div>
              <span className="flex items-center text-[10px] text-emerald-500 font-bold">
                +12.5% <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>
            <p className="text-2xl font-serif font-bold gold-text">${stats?.totalRevenue?.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold mt-1">Gross Revenue</p>
          </div>

          <div className="glass-panel p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-blue-500/10 rounded">
                <ShoppingCart className="w-5 h-5 text-blue-500" />
              </div>
              <span className="flex items-center text-[10px] text-blue-500 font-bold">
                +4.2% <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>
            <p className="text-2xl font-serif font-bold">{stats?.orderCount}</p>
            <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold mt-1">Total Conversions</p>
          </div>

          <div className="glass-panel p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-purple-500/10 rounded">
                <Users className="w-5 h-5 text-purple-500" />
              </div>
            </div>
            <p className="text-2xl font-serif font-bold">${stats?.averageOrderValue?.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold mt-1">Avg. Ticket Size</p>
          </div>

          <div className="glass-panel p-6 border-primary/20 bg-primary/5">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-primary/10 rounded">
                <Crown className="w-5 h-5 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-serif font-bold">8.4%</p>
            <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-bold mt-1">Retention Rate</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Recent Performance */}
          <div className="md:col-span-2 glass-panel p-8 space-y-6">
            <h3 className="text-sm font-bold tracking-widest uppercase text-primary">Recent Order Velocity</h3>
            <div className="space-y-4">
              {stats?.recentSales?.map((sale: any) => (
                <div key={sale.orderId} className="flex justify-between items-center pb-4 border-b border-border/40 last:border-0 last:pb-0">
                  <div className="flex gap-4 items-center">
                    <div className="w-10 h-10 bg-secondary rounded flex items-center justify-center text-[10px] font-bold">
                      ORD
                    </div>
                    <div>
                      <p className="text-xs font-bold">{sale.shipping?.fullName || "Anonymous"}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(sale.createdAt).toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <p className="text-sm font-serif font-bold gold-text">${sale.total.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tier Insights */}
          <div className="glass-panel p-8 space-y-6">
            <h3 className="text-sm font-bold tracking-widest uppercase text-primary">Member Distribution</h3>
            <div className="space-y-5">
              {[
                { label: "Diamond Elite", count: 12, tier: "Diamond" },
                { label: "Platinum", count: 45, tier: "Platinum" },
                { label: "Gold", count: 128, tier: "Gold" },
                { label: "Silver", count: 342, tier: "Silver" },
                { label: "Bronze", count: 890, tier: "Bronze" },
              ].map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                    <TierBadge tier={item.tier as any} className="scale-75 origin-left" />
                    <span>{item.count} members</span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.count / 1400) * 100}%` }}
                      className="h-full bg-primary"
                    />
                  </div>
                </div>
              ))}
            </div>
            
            <div className="pt-6 mt-6 border-t border-border/40">
              <div className="bg-primary/5 p-4 border border-primary/10 rounded flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Staff Insight</p>
                  <p className="text-xs text-muted-foreground">The Alchemist Circle comprises 0.2% of your user base.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
