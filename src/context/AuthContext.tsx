import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  reauthenticateWithCredential,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
  updateEmail,
  updatePassword,
  updateProfile as updateFirebaseProfile,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import type { EmploymentStatus, UserRole, UserTier } from "../../server/types";

export interface AuthProfile {
  userId: string;
  email: string;
  role: UserRole;
  tier: UserTier;
  isApproved: boolean;
  points: number;
  totalSpent: number;
  accountBalance: number;
  completedOrderCount?: number;
  referralCount?: number;
  swapCount?: number;
  employmentStatus?: EmploymentStatus;
  department?: string;
  hrNotes?: string;
  joinedAt?: string;
  lastRoleUpdatedAt?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profile: AuthProfile | null;
  profileError: string | null;
  isGuest: boolean;
  logout: () => Promise<void>;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: { email: string; password: string }) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  getIdToken: () => Promise<string>;
  refreshProfile: () => Promise<AuthProfile | null>;
  verifyEmail: () => Promise<void>;
  updateUserProfile: (data: { displayName?: string | null }) => Promise<void>;
  updateUserEmail: (email: string, password: string) => Promise<void>;
  updateUserPassword: (newPassword: string, currentPassword: string) => Promise<void>;
  hasPasswordProvider: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

function requireAuth() {
  if (!auth) {
    throw new Error("Firebase Auth is not configured. Check your VITE_FIREBASE_* environment variables.");
  }
  return auth;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const requestRef = useRef(0);

  const loadProfile = useCallback(async (activeUser: User, forceRefresh = false) => {
    const requestId = ++requestRef.current;
    const token = await activeUser.getIdToken(forceRefresh);
    const response = await fetch("/api/user/profile", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || "Unable to load your account profile.");
    }

    if (requestId !== requestRef.current) {
      return null;
    }

    const nextProfile = (data.profile ?? null) as AuthProfile | null;
    setProfile(nextProfile);
    setProfileError(null);
    return nextProfile;
  }, []);

  useEffect(() => {
    if (!auth) {
      setAuthResolved(true);
      setProfileError("Firebase Auth is not configured. Check your VITE_FIREBASE_* environment variables.");
      return;
    }

    const unsubscribe = onIdTokenChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser || nextUser.isAnonymous) {
        requestRef.current += 1;
        setProfile(null);
        setProfileError(null);
        setProfileLoading(false);
        setAuthResolved(true);
        return;
      }

      setProfileLoading(true);

      try {
        await loadProfile(nextUser);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load your account profile.";
        setProfile(null);
        setProfileError(message);
      } finally {
        setProfileLoading(false);
        setAuthResolved(true);
      }
    });

    return () => unsubscribe();
  }, [loadProfile]);

  const login = async (credentials: { email: string; password: string }) => {
    await signInWithEmailAndPassword(requireAuth(), credentials.email, credentials.password);
  };

  const register = async (data: { email: string; password: string }) => {
    await createUserWithEmailAndPassword(requireAuth(), data.email, data.password);
  };

  const logout = async () => {
    requestRef.current += 1;
    setProfile(null);
    setProfileError(null);
    await signOut(requireAuth());
  };

  const continueAsGuest = async () => {
    await signInAnonymously(requireAuth());
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(requireAuth(), email);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(requireAuth(), provider);
  };

  const signInWithApple = async () => {
    const provider = new OAuthProvider("apple.com");
    provider.addScope("email");
    provider.addScope("name");
    await signInWithPopup(requireAuth(), provider);
  };

  const getIdToken = async () => {
    const currentAuth = requireAuth();
    const activeUser = currentAuth.currentUser ?? user;
    return activeUser ? activeUser.getIdToken() : "";
  };

  const refreshProfile = useCallback(async () => {
    const currentAuth = requireAuth();
    const activeUser = currentAuth.currentUser ?? user;

    if (!activeUser || activeUser.isAnonymous) {
      requestRef.current += 1;
      setProfile(null);
      setProfileError(null);
      return null;
    }

    setProfileLoading(true);
    try {
      return await loadProfile(activeUser, true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to refresh your account profile.";
      setProfile(null);
      setProfileError(message);
      throw err;
    } finally {
      setProfileLoading(false);
    }
  }, [loadProfile, user]);

  const verifyEmail = async () => {
    const currentAuth = requireAuth();
    const activeUser = currentAuth.currentUser ?? user;
    if (!activeUser) {
      throw new Error("You must be signed in to verify your email.");
    }
    await sendEmailVerification(activeUser);
  };

  const updateUserProfile = async (data: { displayName?: string | null }) => {
    const currentAuth = requireAuth();
    const activeUser = currentAuth.currentUser ?? user;
    if (!activeUser) {
      throw new Error("You must be signed in to update your profile.");
    }

    await updateFirebaseProfile(activeUser, data);
    await reload(activeUser);
    setUser(currentAuth.currentUser);
  };

  const updateUserEmail = async (email: string, password: string) => {
    const currentAuth = requireAuth();
    const activeUser = currentAuth.currentUser ?? user;
    if (!activeUser || !activeUser.email) {
      throw new Error("You must be signed in to update your email.");
    }

    const hasPasswordProvider = activeUser.providerData.some(
      (provider) => provider.providerId === EmailAuthProvider.PROVIDER_ID
    );

    if (hasPasswordProvider) {
      if (!password) {
        throw new Error("Please enter your current password to change your email.");
      }
      const credential = EmailAuthProvider.credential(activeUser.email, password);
      await reauthenticateWithCredential(activeUser, credential);
    }

    await updateEmail(activeUser, email);
    await reload(activeUser);
    await refreshProfile();
    setUser(currentAuth.currentUser);
  };

  const updateUserPassword = async (newPassword: string, currentPassword: string) => {
    const currentAuth = requireAuth();
    const activeUser = currentAuth.currentUser ?? user;
    if (!activeUser || !activeUser.email) {
      throw new Error("You must be signed in to change your password.");
    }

    const credential = EmailAuthProvider.credential(activeUser.email, currentPassword);
    await reauthenticateWithCredential(activeUser, credential);
    await updatePassword(activeUser, newPassword);
    await reload(activeUser);
    setUser(currentAuth.currentUser);
  };

  const hasPasswordProvider = useMemo(
    () =>
      user?.providerData.some((provider) => provider.providerId === EmailAuthProvider.PROVIDER_ID) ??
      false,
    [user]
  );

  const loading = !authResolved || profileLoading;

  const contextValue: AuthContextType = {
    user,
    loading,
    profile,
    profileError,
    isGuest: user?.isAnonymous || false,
    logout,
    login,
    register,
    continueAsGuest,
    resetPassword,
    signInWithGoogle,
    signInWithApple,
    getIdToken,
    refreshProfile,
    verifyEmail,
    updateUserProfile,
    updateUserEmail,
    updateUserPassword,
    hasPasswordProvider,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
