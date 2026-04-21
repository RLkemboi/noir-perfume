import { initializeApp, cert, type ServiceAccount, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

const projectId = process.env.FIREBASE_PROJECT_ID;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

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
  } catch (err) {
    console.warn("[Firebase] Failed to initialize:", err instanceof Error ? err.message : err);
  }
}

if (!db) {
  console.warn(
    "[Firebase] Using in-memory fallback for carts and orders. " +
      "Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL to use Firestore."
  );
}

function isFirestoreConnectionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? (err as { code?: unknown }).code : undefined;
  const message = err instanceof Error ? err.message : String(err);
  return (
    code === 14 ||
    message.includes("UNAVAILABLE") ||
    message.includes("ECONNRESET") ||
    message.includes("No connection established")
  );
}

function disableFirestore(err: unknown): boolean {
  if (!isFirestoreConnectionError(err)) return false;
  firestoreAvailable = false;
  if (!loggedFirestoreFallback) {
    loggedFirestoreFallback = true;
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[Firebase] Firestore unavailable. Switching to in-memory fallback for this session. ${reason}`);
  }
  return true;
}

function canUseFirestore(): boolean {
  return Boolean(db) && firestoreAvailable;
}

export { db, app, auth, canUseFirestore, disableFirestore };
