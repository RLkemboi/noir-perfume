import { db, canUseFirestore, disableFirestore } from "./firebase.js";
import type { EmploymentStatus, UserProfile, UserRole, UserTier } from "../types.js";

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

function getEmploymentStatus(role: UserRole, isApproved: boolean): EmploymentStatus {
  if (role === "Customer") return "Active";
  return isApproved ? "Active" : "PendingApproval";
}

function normalizeProfile(profile: UserProfile): UserProfile {
  return {
    ...profile,
    accountBalance: Number((profile.accountBalance ?? 0).toFixed(2)),
  };
}

async function withUsersFallback<T>(action: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  if (!usersCollection || !canUseFirestore()) {
    return await fallback();
  }

  try {
    return await action();
  } catch (err) {
    if (disableFirestore(err)) {
      return await fallback();
    }
    throw err;
  }
}

function getOrCreateMemoryProfile(userId: string, email?: string): UserProfile {
  const isAdmin = isAdminEmail(email);
  let profile = memoryProfiles.get(userId);
  if (!profile) {
    profile = {
      userId,
      email: email || "",
      tier: isAdmin ? "The Alchemist Circle" : "Junior",
      role: isAdmin ? "Admin" : "Customer",
      isApproved: isAdmin,
      points: isAdmin ? 999999 : 0,
      totalSpent: 0,
      accountBalance: 0,
      joinedAt: new Date().toISOString(),
      employmentStatus: getEmploymentStatus(isAdmin ? "Admin" : "Customer", isAdmin),
      department: isAdmin ? "Executive" : undefined,
      hrNotes: "",
      lastRoleUpdatedAt: new Date().toISOString(),
    };
    memoryProfiles.set(userId, profile);
  } else if (isAdmin && (!profile.isApproved || profile.role !== "Admin")) {
    profile.isApproved = true;
    profile.role = "Admin";
    profile.tier = "The Alchemist Circle";
    profile.employmentStatus = "Active";
    profile.department = profile.department || "Executive";
    profile.lastRoleUpdatedAt = new Date().toISOString();
    memoryProfiles.set(userId, profile);
  }
  return normalizeProfile(profile);
}

export async function getUserProfile(userId: string, email?: string): Promise<UserProfile> {
  const isAdmin = isAdminEmail(email);

  if (!usersCollection || !canUseFirestore()) {
    return getOrCreateMemoryProfile(userId, email);
  }

  return withUsersFallback(
    async () => {
      const doc = await usersCollection.doc(userId).get();
      if (doc.exists) {
        const profile = normalizeProfile(doc.data() as UserProfile);
        if (isAdmin && (!profile.isApproved || profile.role !== "Admin")) {
          profile.isApproved = true;
          profile.role = "Admin";
          profile.tier = "The Alchemist Circle";
          await usersCollection.doc(userId).update({
            isApproved: true,
            role: "Admin",
            tier: "The Alchemist Circle",
            employmentStatus: "Active",
            department: profile.department || "Executive",
            lastRoleUpdatedAt: new Date().toISOString(),
          });
        }
        return profile;
      }

      const newProfile: UserProfile = {
        userId,
        email: email || "",
        tier: isAdmin ? "The Alchemist Circle" : "Junior",
        role: isAdmin ? "Admin" : "Customer",
        isApproved: isAdmin,
        points: isAdmin ? 999999 : 0,
        totalSpent: 0,
        accountBalance: 0,
        joinedAt: new Date().toISOString(),
        employmentStatus: getEmploymentStatus(isAdmin ? "Admin" : "Customer", isAdmin),
        department: isAdmin ? "Executive" : undefined,
        hrNotes: "",
        lastRoleUpdatedAt: new Date().toISOString(),
      };

      await usersCollection.doc(userId).set(newProfile);
      return normalizeProfile(newProfile);
    },
    () => getOrCreateMemoryProfile(userId, email)
  );
}

export async function registerStaffApplication(userId: string, email: string, role: UserRole): Promise<UserProfile> {
  const isAdmin = isAdminEmail(email);

  const profile = await getUserProfile(userId, email);
  profile.role = isAdmin ? "Admin" : role;
  profile.isApproved = isAdmin; // Admin is auto-approved, others must wait
  profile.tier = isAdmin ? "The Alchemist Circle" : "Junior";
  profile.employmentStatus = getEmploymentStatus(profile.role, profile.isApproved);
  profile.department = profile.department || (profile.role === "Customer" ? undefined : "General");
  profile.lastRoleUpdatedAt = new Date().toISOString();
  
  if (!usersCollection || !canUseFirestore()) {
    memoryProfiles.set(userId, profile);
    return profile;
  }

  return withUsersFallback(
    async () => {
      await usersCollection.doc(userId).set(profile);
      return profile;
    },
    () => {
      memoryProfiles.set(userId, profile);
      return profile;
    }
  );
}

export async function getPendingStaff(): Promise<UserProfile[]> {
  return withUsersFallback(
    async () => {
      const snapshot = await usersCollection!.where("isApproved", "==", false).get();
      return snapshot.docs.map(d => normalizeProfile(d.data() as UserProfile)).filter(p => p.role !== "Customer");
    },
    () => Array.from(memoryProfiles.values()).map(normalizeProfile).filter(p => !p.isApproved && p.role !== "Customer")
  );
}

export async function getStaffMembers(): Promise<UserProfile[]> {
  return withUsersFallback(
    async () => {
      const snapshot = await usersCollection!.get();
      return snapshot.docs
        .map((doc) => normalizeProfile(doc.data() as UserProfile))
        .filter((profile) => profile.role !== "Customer")
        .sort((a, b) => a.email.localeCompare(b.email));
    },
    () => Array.from(memoryProfiles.values())
      .map(normalizeProfile)
      .filter((profile) => profile.role !== "Customer")
      .sort((a, b) => a.email.localeCompare(b.email))
  );
}

export async function approveStaff(userId: string): Promise<UserProfile | null> {
  if (!usersCollection || !canUseFirestore()) {
    const profile = memoryProfiles.get(userId);
    if (!profile) return null;
    profile.isApproved = true;
    profile.employmentStatus = "Active";
    profile.lastRoleUpdatedAt = new Date().toISOString();
    memoryProfiles.set(userId, profile);
    return normalizeProfile(profile);
  }

  return withUsersFallback(
    async () => {
      const docRef = usersCollection.doc(userId);
      const doc = await docRef.get();
      if (!doc.exists) return null;

      await docRef.update({ isApproved: true, employmentStatus: "Active", lastRoleUpdatedAt: new Date().toISOString() });
      const updated = (await docRef.get()).data() as UserProfile;
      return normalizeProfile(updated);
    },
    () => approveStaff(userId)
  );
}

export async function updateStaffProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, "role" | "isApproved" | "employmentStatus" | "department" | "hrNotes">>
): Promise<UserProfile | null> {
  const now = new Date().toISOString();

  if (!usersCollection || !canUseFirestore()) {
    const profile = memoryProfiles.get(userId);
    if (!profile) return null;

    const nextRole = updates.role ?? profile.role;
    const nextApproved = updates.isApproved ?? profile.isApproved;
    const nextEmploymentStatus =
      updates.employmentStatus ?? (nextApproved ? "Active" : getEmploymentStatus(nextRole, nextApproved));

    Object.assign(profile, {
      ...updates,
      role: nextRole,
      isApproved: nextApproved,
      employmentStatus: nextEmploymentStatus,
      lastRoleUpdatedAt: now,
    });

    memoryProfiles.set(userId, profile);
    return normalizeProfile(profile);
  }

  return withUsersFallback(
    async () => {
      const docRef = usersCollection.doc(userId);
      const doc = await docRef.get();
      if (!doc.exists) return null;

      const current = doc.data() as UserProfile;
      const nextRole = updates.role ?? current.role;
      const nextApproved = updates.isApproved ?? current.isApproved;
      const nextEmploymentStatus =
        updates.employmentStatus ?? (nextApproved ? "Active" : getEmploymentStatus(nextRole, nextApproved));

      await docRef.update({
        ...updates,
        role: nextRole,
        isApproved: nextApproved,
        employmentStatus: nextEmploymentStatus,
        lastRoleUpdatedAt: now,
      });

      return normalizeProfile((await docRef.get()).data() as UserProfile);
    },
    () => updateStaffProfile(userId, updates)
  );
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
    else if (profile.totalSpent > 0) profile.tier = "Bronze";
    else profile.tier = "Junior";
  }

  if (!usersCollection || !canUseFirestore()) {
    memoryProfiles.set(userId, profile);
    return normalizeProfile(profile);
  }

  return withUsersFallback(
    async () => {
      await usersCollection.doc(userId).update({
        totalSpent: profile.totalSpent,
        points: profile.points,
        tier: profile.tier,
      });
      return normalizeProfile(profile);
    },
    () => {
      memoryProfiles.set(userId, profile);
      return normalizeProfile(profile);
    }
  );
}

export async function adjustUserAccountBalance(userId: string, delta: number): Promise<UserProfile> {
  const profile = await getUserProfile(userId);
  profile.accountBalance = Number(((profile.accountBalance ?? 0) + delta).toFixed(2));

  if (!usersCollection || !canUseFirestore()) {
    memoryProfiles.set(userId, profile);
    return normalizeProfile(profile);
  }

  return withUsersFallback(
    async () => {
      await usersCollection.doc(userId).update({
        accountBalance: profile.accountBalance,
      });
      return normalizeProfile(profile);
    },
    () => {
      memoryProfiles.set(userId, profile);
      return normalizeProfile(profile);
    }
  );
}

export async function setSpecialTier(userId: string, tier: UserTier): Promise<UserProfile> {
  const profile = await getUserProfile(userId);
  profile.tier = tier;

  if (!usersCollection || !canUseFirestore()) {
    memoryProfiles.set(userId, profile);
    return normalizeProfile(profile);
  }

  return withUsersFallback(
    async () => {
      await usersCollection.doc(userId).update({ tier: profile.tier });
      return normalizeProfile(profile);
    },
    () => {
      memoryProfiles.set(userId, profile);
      return normalizeProfile(profile);
    }
  );
}
