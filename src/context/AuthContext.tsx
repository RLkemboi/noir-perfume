import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export interface UserProfile {
  userId: string;
  email: string;
  tier: "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond" | "The Alchemist Circle";
  role: "Customer" | "Operator" | "Manager" | "DeliveryAgent" | "Admin" | "Marketing";
  isApproved: boolean;
  points: number;
  totalSpent: number;
  joinedAt: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isGuest: boolean;
  hasPasswordProvider: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  resetPassword: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  continueAsGuest: () => void;
  verifyEmail: () => Promise<void>;
  updateUserProfile: (data: { displayName?: string; photoURL?: string }) => Promise<void>;
  updateUserEmail: (email: string, currentPassword: string) => Promise<void>;
  updateUserPassword: (password: string, currentPassword: string) => Promise<void>;
  reauthenticate: (password: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GUEST_KEY = "noir-guest";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    return safeGet(GUEST_KEY) === "true";
  });

  const hasPasswordProvider = user?.providerData?.some((p) => p.providerId === "password") ?? false;

  const refreshProfile = useCallback(async () => {
    if (!auth?.currentUser) {
      setProfile(null);
      return;
    }
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/user/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      const id = setTimeout(() => setLoading(false), 0);
      return () => clearTimeout(id);
    }
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setIsGuest(false);
        safeRemove(GUEST_KEY);
        await refreshProfile();
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [refreshProfile]);

  const login = async (email: string, password: string) => {
    if (!auth) throw new Error("Authentication is not configured. Please check your environment settings.");
    await signInWithEmailAndPassword(auth, email, password);
    setIsGuest(false);
    safeRemove(GUEST_KEY);
  };

  const register = async (email: string, password: string) => {
    if (!auth) throw new Error("Authentication is not configured. Please check your environment settings.");
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (cred.user) {
      try {
        await sendEmailVerification(cred.user);
      } catch {
        // Non-fatal: account is created even if verification email fails
      }
    }
    setIsGuest(false);
    safeRemove(GUEST_KEY);
  };

  const logout = async () => {
    try {
      if (auth) {
        await signOut(auth);
      }
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      // Always clear local state even if Firebase signOut fails or isn't available
      setUser(null);
      setProfile(null);
      setIsGuest(false);
      safeRemove(GUEST_KEY);
    }
  };

  const getIdToken = useCallback(async () => {
    const currentUser = auth?.currentUser ?? user;
    if (!currentUser) return null;
    return currentUser.getIdToken(true);
  }, [user]);

  const resetPassword = async (email: string) => {
    if (!auth) throw new Error("Authentication is not configured. Please check your environment settings.");
    await sendPasswordResetEmail(auth, email);
  };

  const signInWithGoogle = async () => {
    if (!auth) throw new Error("Authentication is not configured. Please check your environment settings.");
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    setIsGuest(false);
    safeRemove(GUEST_KEY);
  };

  const signInWithApple = async () => {
    if (!auth) throw new Error("Authentication is not configured. Please check your environment settings.");
    const provider = new OAuthProvider("apple.com");
    provider.addScope("email");
    provider.addScope("name");
    await signInWithPopup(auth, provider);
    setIsGuest(false);
    safeRemove(GUEST_KEY);
  };

  const continueAsGuest = () => {
    setIsGuest(true);
    safeSet(GUEST_KEY, "true");
  };

  const verifyEmail = async () => {
    if (!auth || !auth.currentUser) throw new Error("No user is currently signed in.");
    await sendEmailVerification(auth.currentUser);
  };

  const updateUserProfile = async (data: { displayName?: string; photoURL?: string }) => {
    if (!auth || !auth.currentUser) throw new Error("No user is currently signed in.");
    await updateProfile(auth.currentUser, data);
    setUser({ ...auth.currentUser });
  };

  const reauthenticate = async (password: string) => {
    if (!auth || !auth.currentUser) throw new Error("No user is currently signed in.");
    const email = auth.currentUser.email;
    if (!email) throw new Error("Account has no email address.");
    const credential = EmailAuthProvider.credential(email, password);
    await reauthenticateWithCredential(auth.currentUser, credential);
  };

  const updateUserEmail = async (email: string, currentPassword: string) => {
    if (!auth || !auth.currentUser) throw new Error("No user is currently signed in.");
    if (hasPasswordProvider) {
      await reauthenticate(currentPassword);
    }
    await updateEmail(auth.currentUser, email);
    setUser({ ...auth.currentUser });
  };

  const updateUserPassword = async (password: string, currentPassword: string) => {
    if (!auth || !auth.currentUser) throw new Error("No user is currently signed in.");
    if (!hasPasswordProvider) throw new Error("Password can only be changed for accounts created with email and password.");
    await reauthenticate(currentPassword);
    await updatePassword(auth.currentUser, password);
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, isGuest, hasPasswordProvider, login, register, logout, getIdToken, resetPassword, signInWithGoogle, signInWithApple, continueAsGuest, verifyEmail, updateUserProfile, updateUserEmail, updateUserPassword, reauthenticate, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
