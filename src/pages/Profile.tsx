import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, User, Mail, Lock, Save, Send, ShieldCheck, AlertCircle, Info } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function Profile() {
  const { user, verifyEmail, updateUserProfile, updateUserEmail, updateUserPassword, hasPasswordProvider, loading: authLoading } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [profilePassword, setProfilePassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);

  // Sync form state when user object changes from context (e.g. after successful update)
  useEffect(() => {
    if (!submittingProfile && !submittingPassword) {
      setDisplayName(user?.displayName || "");
      setEmail(user?.email || "");
    }
  }, [user, submittingProfile, submittingPassword]);

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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground font-serif italic">Please sign in to view your profile.</p>
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

  const isEmailVerified = user.emailVerified;
  const emailChanged = email !== user.email;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingProfile(true);
    try {
      const updates: { displayName?: string } = {};
      if (displayName !== user.displayName) {
        updates.displayName = displayName;
      }
      if (Object.keys(updates).length > 0) {
        await updateUserProfile(updates);
      }
      if (emailChanged) {
        if (hasPasswordProvider && !profilePassword) {
          toast.error("Please enter your current password to change your email.");
          setSubmittingProfile(false);
          return;
        }
        await updateUserEmail(email, profilePassword);
        setProfilePassword("");
      }
      toast.success("Profile updated successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update profile";
      toast.error(msg.replace("Firebase: ", "").replace(/\(.*\)/, "").trim());
    } finally {
      setSubmittingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (!currentPassword) {
      toast.error("Please enter your current password.");
      return;
    }
    setSubmittingPassword(true);
    try {
      await updateUserPassword(newPassword, currentPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update password";
      toast.error(msg.replace("Firebase: ", "").replace(/\(.*\)/, "").trim());
    } finally {
      setSubmittingPassword(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      await verifyEmail();
      toast.success("Verification email sent. Check your inbox.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send verification email";
      toast.error(msg.replace("Firebase: ", "").replace(/\(.*\)/, "").trim());
    }
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-4">
      <div className="container mx-auto max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-serif text-3xl font-bold gold-text">My Profile</h1>
              <p className="text-muted-foreground text-sm mt-1">Manage your account settings</p>
            </div>
            <Link
              to="/dashboard"
              className="flex items-center gap-2 px-4 py-2 border border-border text-muted-foreground text-xs tracking-widest uppercase font-bold hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </Link>
          </div>

          {!isEmailVerified && (
            <div className="mb-6 p-4 border border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-amber-200">Your email address is not verified.</p>
                <button
                  onClick={handleResendVerification}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors tracking-widest uppercase font-bold"
                >
                  <Send className="w-3 h-3" /> Resend verification email
                </button>
              </div>
            </div>
          )}

          {isEmailVerified && (
            <div className="mb-6 p-4 border border-emerald-500/30 bg-emerald-500/5 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
              <p className="text-sm text-emerald-200">Your email address is verified.</p>
            </div>
          )}

          <div className="glass-panel p-8 space-y-8">
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <h2 className="font-serif text-xl font-bold flex items-center gap-2">
                <User className="w-5 h-5 text-primary" /> Profile Information
              </h2>

              <div className="space-y-2">
                <label className="text-xs tracking-widest uppercase text-muted-foreground font-bold">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                  placeholder="Your name"
                />
              </div>

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

              {emailChanged && hasPasswordProvider && (
                <div className="space-y-2">
                  <label className="text-xs tracking-widest uppercase text-muted-foreground font-bold">
                    Current Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="password"
                      value={profilePassword}
                      onChange={(e) => setProfilePassword(e.target.value)}
                      className="w-full bg-background border border-border pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Changing your email requires re-authentication.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={submittingProfile}
                className="w-full py-3 bg-primary text-primary-foreground text-xs tracking-widest uppercase font-bold hover:bg-gold-light transition-colors luxury-shadow disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {submittingProfile ? "Saving..." : "Save Changes"}
              </button>
            </form>

            {hasPasswordProvider && (
              <>
                <div className="border-t border-border" />

                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <h2 className="font-serif text-xl font-bold flex items-center gap-2">
                    <Lock className="w-5 h-5 text-primary" /> Change Password
                  </h2>

                  <div className="space-y-2">
                    <label className="text-xs tracking-widest uppercase text-muted-foreground font-bold">
                      Current Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full bg-background border border-border pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs tracking-widest uppercase text-muted-foreground font-bold">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                      placeholder="••••••••"
                      minLength={6}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs tracking-widest uppercase text-muted-foreground font-bold">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                      placeholder="••••••••"
                      minLength={6}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingPassword || !currentPassword || !newPassword || !confirmPassword}
                    className="w-full py-3 bg-primary text-primary-foreground text-xs tracking-widest uppercase font-bold hover:bg-gold-light transition-colors luxury-shadow disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    {submittingPassword ? "Updating..." : "Update Password"}
                  </button>
                </form>
              </>
            )}

            {!hasPasswordProvider && (
              <div className="p-4 border border-border bg-background/50 flex items-start gap-3">
                <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  You signed in with a social provider. Password management is handled through your provider.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
