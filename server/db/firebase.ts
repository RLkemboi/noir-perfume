import { initializeApp, cert, type ServiceAccount, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { addSystemLog, setLogPersister, type SystemLog } from "./logs.js";

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
    console.log("[Firebase] Connected to Firestore.");
    addSystemLog("info", "Firebase", "Successfully connected to Firestore.");

    // Wire Firestore log persistence (fire-and-forget, never throws)
    const logsCol = db.collection("system_logs");
    setLogPersister((log: SystemLog) => {
      void logsCol.doc(log.id).set(log);
    });

    // Seed in-memory buffer with recent logs so history survives restarts
    void logsCol
      .orderBy("timestamp", "desc")
      .limit(500)
      .get()
      .then((snap) => {
        // Add in reverse so newest ends up at index 0 after unshift
        const docs = snap.docs.map((d) => d.data() as SystemLog).reverse();
        for (const entry of docs) {
          addSystemLog(entry.level, entry.source, entry.message);
        }
      })
      .catch(() => {
        // Non-fatal: log history just won't be pre-loaded
      });
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
