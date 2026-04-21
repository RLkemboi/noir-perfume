import { initializeApp, cert, type ServiceAccount, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { addSystemLog } from "./logs.js";

const projectId = process.env.FIREBASE_PROJECT_ID?.replace(/^["'](.+)["']$/, "$1");
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/^["'](.+)["']$/, "$1")?.replace(/\\n/g, "\n");
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.replace(/^["'](.+)["']$/, "$1");

let db: Firestore | undefined;
let app: App | undefined;
let auth: Auth | undefined;
let firestoreAvailable = false;
let loggedFirestoreFallback = false;

const looksReal =
  projectId &&
  projectId !== "your-project-id" &&
  privateKey &&
  privateKey.includes("BEGIN PRIVATE KEY") &&
  clientEmail &&
  clientEmail.includes("iam.gserviceaccount.com");

if (looksReal) {
  try {
    app = initializeApp({
      credential: cert({ projectId, privateKey, clientEmail } as ServiceAccount),
    });
    db = getFirestore(app);
    db.settings({ ignoreUndefinedProperties: true });
    auth = getAuth(app);
    firestoreAvailable = true;
    console.log("[Firebase] Connected to Firestore.")
    addSystemLog("info", "Firebase", "Successfully connected to Firestore.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[Firebase] Failed to initialize:", msg);
    addSystemLog("critical", "FirebaseInit", `Failed to initialize: ${msg}`);
  }
} else {
  addSystemLog("warning", "FirebaseInit", "Firebase credentials missing or invalid format. Using in-memory fallback.");
}

if (!db) {
  console.warn(
    "[Firebase] Using in-memory fallback for carts and orders. " +
      "Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL to use Firestore."
  );
}

function disableFirestore(err: unknown): boolean {
  firestoreAvailable = false;
  if (!loggedFirestoreFallback) {
    loggedFirestoreFallback = true;
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[Firebase] Firestore unavailable. Switching to in-memory fallback for this session. ${reason}`);
    addSystemLog("error", "FirestoreFallback", `Firestore error occurred, falling back to memory: ${reason}`);
  }
  return true;
}

function canUseFirestore(): boolean {
  return Boolean(db) && firestoreAvailable;
}

export { db, app, auth, canUseFirestore, disableFirestore };
