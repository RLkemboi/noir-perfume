import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { CartDrawer } from "@/components/CartDrawer";
import FloatingLogo from "@/components/FloatingLogo";
import { MetalTransition } from "@/components/MetalTransition";
import Index from "./pages/Index.tsx";
import { Shield } from "lucide-react";

// Route-level code splitting: only the landing page ships in the main bundle.
const Catalogue = lazy(() => import("./pages/Catalogue.tsx"));
const Login = lazy(() => import("./pages/Login.tsx"));
const Signup = lazy(() => import("./pages/Signup.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const ProductDetail = lazy(() => import("./pages/ProductDetail.tsx"));
const Checkout = lazy(() => import("./pages/Checkout.tsx"));
const AgentDashboard = lazy(() => import("./pages/AgentDashboard.tsx"));
const OperatorDashboard = lazy(() => import("./pages/OperatorDashboard.tsx"));
const MarketingDashboard = lazy(() => import("./pages/MarketingDashboard.tsx"));
const StaffSignup = lazy(() => import("./pages/StaffSignup.tsx"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard.tsx"));
const ProductManagement = lazy(() =>
  import("./pages/admin/ProductManagement.tsx").then((m) => ({ default: m.ProductManagement }))
);
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient();

function FullScreenStatus({ title, message, actions }: { title: string; message: string; actions?: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full glass-panel p-10 text-center space-y-6">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
          <Shield className="w-10 h-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="font-serif text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground font-sans text-sm">{message}</p>
        </div>
        {actions}
      </div>
    </div>
  );
}

function getPortalPath(profile?: { role?: string } | null) {
  switch (profile?.role) {
    case "Admin":
      return "/admin";
    case "DeliveryAgent":
      return "/agent";
    case "Operator":
    case "Manager":
      return "/operator";
    case "Marketing":
      return "/marketing";
    default:
      return "/dashboard";
  }
}

function AuthRoute({
  children,
  allowGuest = false,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowGuest?: boolean;
  allowedRoles?: string[];
}) {
  const { user, isGuest, loading, profile, profileError, refreshProfile, logout } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user && !(allowGuest && isGuest)) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (isGuest) {
    // Role restrictions apply to authenticated accounts; a route that opts in
    // with allowGuest accepts guests regardless of its role list. Redirecting
    // guests away from such a route (e.g. /dashboard) would loop back to itself.
    if (!allowGuest) {
      return <Navigate to="/" replace />;
    }
    return <>{children}</>;
  }

  if (profileError) {
    return (
      <FullScreenStatus
        title="Account Sync Required"
        message={profileError}
        actions={
          <div className="space-y-3">
            <button
              onClick={() => void refreshProfile()}
              className="block w-full py-4 bg-primary text-primary-foreground text-xs tracking-widest uppercase font-bold hover:bg-gold-light transition-all"
            >
              Retry Profile Sync
            </button>
            <button
              onClick={() => void logout()}
              className="block w-full py-4 border border-border text-muted-foreground text-xs tracking-widest uppercase font-bold hover:text-foreground hover:border-primary/40 transition-all"
            >
              Sign Out
            </button>
          </div>
        }
      />
    );
  }

  if (!profile) {
    return (
      <FullScreenStatus
        title="Profile Unavailable"
        message="We could not load your account role information. Try again in a moment."
        actions={
          <button
            onClick={() => void refreshProfile()}
            className="block w-full py-4 bg-primary text-primary-foreground text-xs tracking-widest uppercase font-bold hover:bg-gold-light transition-all"
          >
            Reload Account
          </button>
        }
      />
    );
  }

  // Staff Guard: If user is staff but not approved, redirect to pending screen
  if (profile && profile.role !== "Customer" && profile.role !== "Admin" && !profile.isApproved) {
    return <PendingApproval />;
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to={getPortalPath(profile)} replace />;
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
  const { user, isGuest, loading, profile } = useAuth();
  if (loading) return null;
  if (user || isGuest) return <Navigate to={getPortalPath(profile)} replace />;
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
            <FloatingLogo />
            <MetalTransition />
            <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/collection" element={<Catalogue />} />
              <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
              <Route path="/signup" element={<GuestRoute><Signup /></GuestRoute>} />
              <Route path="/dashboard" element={<AuthRoute allowGuest allowedRoles={["Customer"]}><Dashboard /></AuthRoute>} />
              <Route path="/profile" element={<AuthRoute><Profile /></AuthRoute>} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/checkout" element={<AuthRoute allowGuest><Checkout /></AuthRoute>} />
              <Route path="/agent" element={<AuthRoute allowedRoles={["DeliveryAgent"]}><AgentDashboard /></AuthRoute>} />
              <Route path="/operator" element={<AuthRoute allowedRoles={["Operator", "Manager", "Admin"]}><OperatorDashboard /></AuthRoute>} />
              <Route path="/marketing" element={<AuthRoute allowedRoles={["Marketing", "Manager", "Admin"]}><MarketingDashboard /></AuthRoute>} />
              <Route path="/staff/signup" element={<StaffSignup />} />
              <Route path="/admin" element={<AuthRoute allowedRoles={["Admin"]}><AdminDashboard /></AuthRoute>} />
              <Route path="/admin/products" element={<AuthRoute allowedRoles={["Admin"]}><ProductManagement /></AuthRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
