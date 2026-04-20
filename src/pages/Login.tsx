import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, LogIn, UserPlus, ArrowLeft, Send, Shield } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const { login, continueAsGuest, resetPassword, signInWithGoogle, signInWithApple } = useAuth();
  const navigate = useNavigate();

  const handleSocial = async (provider: "google" | "apple") => {
    setSubmitting(true);
    try {
      if (provider === "google") {
        await signInWithGoogle();
      } else {
        await signInWithApple();
      }
      toast.success("Welcome back");
      navigate("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      toast.error(msg.replace("Firebase: ", "").replace(/\(.*\)/, "").trim());
    } finally {
      setSubmitting(false);
    }
  };

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
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.05),transparent_50%)]" />
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-fluid" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-fluid" style={{ animationDelay: "-5s" }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <Link to="/" className="font-serif text-4xl tracking-[0.2em] gold-text font-bold mb-2 block">
            NOIR
          </Link>
          <div className="h-px w-12 bg-primary/40 mx-auto mb-4" />
          <p className="text-muted-foreground text-[10px] tracking-[0.3em] uppercase font-bold">
            Private Collection Access
          </p>
        </div>

        <div className="glass-panel p-8 space-y-6 luxury-shadow border-primary/10">
          {!showReset && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleSocial("google")}
                className="w-full py-3 bg-white text-black text-xs tracking-widest uppercase font-bold hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
              <button
                type="button"
                onClick={() => handleSocial("apple")}
                className="w-full py-3 bg-black text-white text-xs tracking-widest uppercase font-bold hover:bg-black/80 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.21-1.96 1.08-3.11-1.05.05-2.31.71-3.06 1.55-.67.75-1.26 1.97-1.1 3.12 1.17.09 2.36-.68 3.08-1.56z"/>
                </svg>
                Continue with Apple
              </button>
            </div>
          )}

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
                } catch {
                  // Ignore errors to prevent email enumeration
                }
                toast.success("If this account exists, a reset link has been sent.");
                setShowReset(false);
                setResetSubmitting(false);
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

              <div className="text-center space-y-4">
                <Link
                  to="/signup"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors tracking-widest uppercase inline-flex items-center gap-1"
                >
                  <UserPlus className="w-3 h-3" /> Don't have an account? Create one
                </Link>

                <div className="flex items-center gap-4 py-2">
                  <div className="h-px bg-border flex-1"></div>
                  <span className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Internal</span>
                  <div className="h-px bg-border flex-1"></div>
                </div>

                <Link 
                  to="/staff/signup" 
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 border border-primary/20 bg-primary/5 text-primary text-[10px] tracking-widest uppercase font-bold hover:bg-primary/10 transition-all"
                >
                  <Shield className="w-3.5 h-3.5" /> Staff Application Portal
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
