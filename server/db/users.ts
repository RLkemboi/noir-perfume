import { db } from "./firebase.js";
import type { UserProfile, UserRole, UserTier } from "../types.js";

const memoryProfiles = new Map<string, UserProfile>();

const usersCollection = db?.collection("users");

const DEFAULT_ADMIN_EMAILS = ["ralph@example.com", "admin@noir-perfume.com"];

function getAdminEmails(): string[] {
  const configured = process.env.ADMIN_EMAILS
    ?.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return configured && configured.length > 0 ? configured : DEFAULT_ADMIN_EMAILS;
}

function isAdminEmail(email?: string): boolean {
  return !!email && getAdminEmails().includes(email.toLowerCase());
}

export async function getUserProfile(userId: string, email?: string): Promise<UserProfile> {
  const isAdmin = isAdminEmail(email);

  if (!usersCollection) {
    let profile = memoryProfiles.get(userId);
    if (!profile) {
      profile = {
        userId,
        email: email || "",
        tier: isAdmin ? "The Alchemist Circle" : "Bronze",
        role: isAdmin ? "Admin" : "Customer",
        isApproved: isAdmin, // Admin is auto-approved
        points: isAdmin ? 999999 : 0,
        totalSpent: 0,
        joinedAt: new Date().toISOString(),
      };
      memoryProfiles.set(userId, profile);
    } else if (isAdmin && (!profile.isApproved || profile.role !== "Admin")) {
      // Correct existing memory profile
      profile.isApproved = true;
      profile.role = "Admin";
      profile.tier = "The Alchemist Circle";
    }
    return profile;
  }

  const doc = await usersCollection.doc(userId).get();
  if (doc.exists) {
    const profile = doc.data() as UserProfile;
    // Force admin status if email matches, even if DB is out of sync
    if (isAdmin && (!profile.isApproved || profile.role !== "Admin")) {
      profile.isApproved = true;
      profile.role = "Admin";
      profile.tier = "The Alchemist Circle";
      await usersCollection.doc(userId).update({ 
        isApproved: true, 
        role: "Admin", 
        tier: "The Alchemist Circle" 
      });
    }
    return profile;
  }

  const newProfile: UserProfile = {
    userId,
    email: email || "",
    tier: isAdmin ? "The Alchemist Circle" : "Bronze",
    role: isAdmin ? "Admin" : "Customer",
    isApproved: isAdmin,
    points: isAdmin ? 999999 : 0,
    totalSpent: 0,
    joinedAt: new Date().toISOString(),
  };

  await usersCollection.doc(userId).set(newProfile);
  return newProfile;
}

export async function registerStaffApplication(userId: string, email: string, role: UserRole): Promise<UserProfile> {
  const isAdmin = isAdminEmail(email);

  const profile = await getUserProfile(userId, email);
  profile.role = isAdmin ? "Admin" : role;
  profile.isApproved = isAdmin; // Admin is auto-approved, others must wait
  profile.tier = isAdmin ? "The Alchemist Circle" : "Bronze";
  
  if (!usersCollection) {
    memoryProfiles.set(userId, profile);
    return profile;
  }

  await usersCollection.doc(userId).set(profile);
  return profile;
}

export async function getPendingStaff(): Promise<UserProfile[]> {
  if (!usersCollection) {
    return Array.from(memoryProfiles.values()).filter(p => !p.isApproved && p.role !== "Customer");
  }
  const snapshot = await usersCollection.where("isApproved", "==", false).get();
  return snapshot.docs.map(d => d.data() as UserProfile).filter(p => p.role !== "Customer");
}

export async function approveStaff(userId: string): Promise<UserProfile | null> {
  if (!usersCollection) {
    const profile = memoryProfiles.get(userId);
    if (!profile) return null;
    profile.isApproved = true;
    memoryProfiles.set(userId, profile);
    return profile;
  }

  const docRef = usersCollection.doc(userId);
  const doc = await docRef.get();
  if (!doc.exists) return null;

  await docRef.update({ isApproved: true });
  const updated = (await docRef.get()).data() as UserProfile;
  return updated;
}

export async function updateUserSpent(userId: string, amount: number): Promise<UserProfile> {
  const profile = await getUserProfile(userId);
  profile.totalSpent += amount;
  profile.points += Math.floor(amount); // 1 point per dollar

  // Update tier based on spending
  if (profile.tier !== "The Alchemist Circle") {
    if (profile.totalSpent >= 5000) profile.tier = "Diamond";
    else if (profile.totalSpent >= 2500) profile.tier = "Platinum";
    else if (profile.totalSpent >= 1000) profile.tier = "Gold";
    else if (profile.totalSpent >= 500) profile.tier = "Silver";
    else profile.tier = "Bronze";
  }

  if (!usersCollection) {
    memoryProfiles.set(userId, profile);
    return profile;
  }

  await usersCollection.doc(userId).update({
    totalSpent: profile.totalSpent,
    points: profile.points,
    tier: profile.tier,
  });

  return profile;
}

export async function setSpecialTier(userId: string, tier: UserTier): Promise<UserProfile> {
  const profile = await getUserProfile(userId);
  profile.tier = tier;

  if (!usersCollection) {
    memoryProfiles.set(userId, profile);
    return profile;
  }

  await usersCollection.doc(userId).update({ tier: profile.tier });
  return profile;
}
