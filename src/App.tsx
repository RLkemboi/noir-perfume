import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { CartDrawer } from "@/components/CartDrawer";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Profile from "./pages/Profile.tsx";
import ProductDetail from "./pages/ProductDetail.tsx";
import Checkout from "./pages/Checkout.tsx";
import AgentDashboard from "./pages/AgentDashboard.tsx";
import OperatorDashboard from "./pages/OperatorDashboard.tsx";
import MarketingDashboard from "./pages/MarketingDashboard.tsx";
import StaffSignup from "./pages/StaffSignup.tsx";
import AdminDashboard from "./pages/AdminDashboard.tsx";
import NotFound from "./pages/NotFound.tsx";
import { Shield } from "lucide-react";

const queryClient = new QueryClient();

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, isGuest, loading, profile } = useAuth();
  if (loading) return null;
  if (!user && !isGuest) return <Navigate to="/login" replace />;

  // Staff Guard: If user is staff but not approved, redirect to pending screen
  if (profile && profile.role !== "Customer" && profile.role !== "Admin" && !profile.isApproved) {
    return <PendingApproval />;
  }

  return <>{children}</>;
}

function PendingApproval() {
  const { logout } = useAuth();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full glass-panel p-10 text-center space-y-6">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
          <Shield className="w-10 h-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="font-serif text-3xl font-bold">Access Pending</h1>
          <p className="text-muted-foreground font-sans text-sm">
            Your staff account is currently awaiting administrator approval.
          </p>
        </div>
        <p className="text-[10px] tracking-widest uppercase font-bold text-primary">
          Check back soon
        </p>
        <button 
          onClick={() => logout()}
          className="block w-full py-4 bg-primary text-primary-foreground text-xs tracking-widest uppercase font-bold hover:bg-gold-light transition-all"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, isGuest, loading } = useAuth();
  if (loading) return null;
  if (user || isGuest) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CartProvider>
          <Sonner position="top-center" />
          <BrowserRouter>
            <CartDrawer />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
              <Route path="/signup" element={<GuestRoute><Signup /></GuestRoute>} />
              <Route path="/dashboard" element={<AuthRoute><Dashboard /></AuthRoute>} />
              <Route path="/profile" element={<AuthRoute><Profile /></AuthRoute>} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/agent" element={<AuthRoute><AgentDashboard /></AuthRoute>} />
              <Route path="/operator" element={<AuthRoute><OperatorDashboard /></AuthRoute>} />
              <Route path="/marketing" element={<AuthRoute><MarketingDashboard /></AuthRoute>} />
              <Route path="/staff/signup" element={<StaffSignup />} />
              <Route path="/admin" element={<AuthRoute><AdminDashboard /></AuthRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
