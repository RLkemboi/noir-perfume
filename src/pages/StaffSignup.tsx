import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, UserPlus, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import type { UserRole } from "../../server/types";

export default function StaffSignup() {
  const { register, getIdToken, refreshProfile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<UserRole>("Operator");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (password !== confirmPassword) {
        throw new Error("Passwords do not match");
      }
      await register(email, password);
      const token = await getIdToken();
      
      const res = await fetch("/api/staff/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      });

      if (res.ok) {
        setSubmitted(true);
        await refreshProfile();
        toast.success("Application submitted successfully");
      } else {
        throw new Error("Failed to register staff profile");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full glass-panel p-10 text-center space-y-6"
        >
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="font-serif text-3xl font-bold">Application Received</h1>
            <p className="text-muted-foreground font-sans">
              Your application for <span className="text-primary font-bold uppercase tracking-widest text-xs">{role}</span> has been submitted to the Admin for approval.
            </p>
          </div>
          <p className="text-sm text-muted-foreground italic">
            You will receive access once your account is verified.
          </p>
          <Link
            to="/login"
            className="block w-full py-4 bg-primary text-primary-foreground text-xs tracking-widest uppercase font-bold hover:bg-gold-light transition-all"
          >
            Back to Login
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-4">
      <div className="container mx-auto max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-10 space-y-8"
        >
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h1 className="font-serif text-3xl font-bold">Staff Portal</h1>
            <p className="text-muted-foreground text-xs tracking-widest uppercase font-bold">Create Staff Account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] tracking-widest uppercase text-muted-foreground font-bold">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                placeholder="staff@noir-perfume.com"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] tracking-widest uppercase text-muted-foreground font-bold">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] tracking-widest uppercase text-muted-foreground font-bold">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] tracking-widest uppercase text-muted-foreground font-bold">Select Role</label>
              <div className="grid grid-cols-1 gap-2">
                {(["Manager", "Operator", "DeliveryAgent", "Marketing"] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`px-4 py-3 text-left text-xs tracking-widest uppercase font-bold border transition-all flex justify-between items-center ${
                      role === r ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {r.replace(/([A-Z])/g, " $1").trim()}
                    {role === r && <ArrowRight className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </div>

            <button
              disabled={loading}
              className="w-full py-4 bg-primary text-primary-foreground text-xs tracking-widest uppercase font-bold hover:bg-gold-light transition-all luxury-shadow flex items-center justify-center gap-2"
            >
              {loading ? "Processing..." : <><UserPlus className="w-4 h-4" /> Apply for Access</>}
            </button>
          </form>

          <div className="text-center">
            <Link to="/login" className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground hover:text-primary transition-colors">
              Already have an account? Sign In
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
