import { initializeApp, cert, type ServiceAccount, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

let db: Firestore | undefined;
let app: App | undefined;

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

export { db, app };
