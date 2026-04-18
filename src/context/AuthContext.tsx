import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isGuest: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  resetPassword: (email: string) => Promise<void>;
  continueAsGuest: () => void;
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
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    return safeGet(GUEST_KEY) === "true";
  });

  useEffect(() => {
    if (!auth) {
      const id = setTimeout(() => setLoading(false), 0);
      return () => clearTimeout(id);
    }
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setIsGuest(false);
        safeRemove(GUEST_KEY);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    if (!auth) throw new Error("Authentication is not configured. Please check your environment settings.");
    await signInWithEmailAndPassword(auth, email, password);
    setIsGuest(false);
    safeRemove(GUEST_KEY);
  };

  const register = async (email: string, password: string) => {
    if (!auth) throw new Error("Authentication is not configured. Please check your environment settings.");
    await createUserWithEmailAndPassword(auth, email, password);
    setIsGuest(false);
    safeRemove(GUEST_KEY);
  };

  const logout = async () => {
    if (auth) {
      await signOut(auth);
    }
    setIsGuest(false);
    safeRemove(GUEST_KEY);
  };

  const getIdToken = useCallback(async () => {
    if (!user) return null;
    return user.getIdToken(true);
  }, [user]);

  const resetPassword = async (email: string) => {
    if (!auth) throw new Error("Authentication is not configured. Please check your environment settings.");
    await sendPasswordResetEmail(auth, email);
  };

  const continueAsGuest = () => {
    setIsGuest(true);
    safeSet(GUEST_KEY, "true");
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, isGuest, login, register, logout, getIdToken, resetPassword, continueAsGuest }}
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
