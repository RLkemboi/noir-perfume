import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, LogIn, UserPlus, ArrowLeft, Send } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const { login, continueAsGuest, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success("Welcome back");
      navigate("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      toast.error(msg.replace("Firebase: ", "").replace(/\(.*\)/, "").trim());
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuest = () => {
    continueAsGuest();
    toast.success("Browsing as guest");
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link to="/" className="font-serif text-3xl tracking-[0.2em] gold-text font-bold">
            NOIR
          </Link>
          <p className="text-muted-foreground mt-2 text-sm tracking-widest uppercase">
            Sign in to your account
          </p>
        </div>

        <div className="glass-panel p-8 space-y-6">
          {!showReset ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs tracking-widest uppercase text-muted-foreground font-bold">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-background border border-border pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs tracking-widest uppercase text-muted-foreground font-bold">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-background border border-border pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="text-right mt-1">
                  <button
                    type="button"
                    onClick={() => setShowReset(true)}
                    className="text-[10px] text-muted-foreground hover:text-primary transition-colors tracking-widest uppercase"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-primary text-primary-foreground text-xs tracking-widest uppercase font-bold hover:bg-gold-light transition-colors luxury-shadow disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                {submitting ? "Please wait..." : "Sign In"}
              </button>
            </form>
          ) : (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              onSubmit={async (e) => {
                e.preventDefault();
                if (!email) {
                  toast.error("Please enter your email");
                  return;
                }
                setResetSubmitting(true);
                try {
                  await resetPassword(email);
                  toast.success("Password reset link sent. Check your inbox.");
                  setShowReset(false);
                } catch (err) {
                  const msg = err instanceof Error ? err.message : "Failed to send reset link";
                  toast.error(msg.replace("Firebase: ", "").replace(/\(.*\)/, "").trim());
                } finally {
                  setResetSubmitting(false);
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <label className="text-xs tracking-widest uppercase text-muted-foreground font-bold">
                  Reset Password
                </label>
                <p className="text-[10px] text-muted-foreground">
                  Enter your email and we will send you a link to reset your password.
                </p>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-background border border-border pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={resetSubmitting}
                className="w-full py-3 bg-primary text-primary-foreground text-xs tracking-widest uppercase font-bold hover:bg-gold-light transition-colors luxury-shadow disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                {resetSubmitting ? "Sending..." : "Send Reset Link"}
              </button>
              <button
                type="button"
                onClick={() => setShowReset(false)}
                className="w-full py-3 border border-border text-muted-foreground text-xs tracking-widest uppercase font-bold hover:text-foreground hover:border-primary/40 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </button>
            </motion.form>
          )}

          {!showReset && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground tracking-widest">or</span>
                </div>
              </div>

              <button
                onClick={handleGuest}
                className="w-full py-3 border border-border text-muted-foreground text-xs tracking-widest uppercase font-bold hover:text-foreground hover:border-primary/40 transition-colors flex items-center justify-center gap-2"
              >
                Continue as Guest
              </button>

              <div className="text-center">
                <Link
                  to="/signup"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors tracking-widest uppercase inline-flex items-center gap-1"
                >
                  <UserPlus className="w-3 h-3" /> Don't have an account? Create one
                </Link>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-6 tracking-widest uppercase">
          <Link to="/" className="hover:text-primary transition-colors">← Back to store</Link>
        </p>
      </motion.div>
    </div>
  );
}
