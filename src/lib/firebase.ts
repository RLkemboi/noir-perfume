import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const rawApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const rawProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

function looksReal(value: string | undefined): value is string {
  if (!value) return false;
  const lower = value.toLowerCase();
  // Reject obvious placeholders
  if (lower.includes("your-")) return false;
  if (lower.includes("xxx")) return false;
  if (value === "123456789") return false;
  if (value.startsWith("1:123456789:")) return false;
  return true;
}

const firebaseConfig = {
  apiKey: rawApiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: rawProjectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;

try {
  const hasRealConfig = looksReal(firebaseConfig.apiKey) && looksReal(firebaseConfig.projectId);
  if (hasRealConfig) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  } else if (import.meta.env.DEV) {
    console.warn(
      "[Firebase] Client config contains placeholder values. Auth features will be unavailable. " +
        "Set real values in your .env file."
    );
  }
} catch (err) {
  if (import.meta.env.DEV) {
    console.warn("[Firebase] Initialization failed:", err instanceof Error ? err.message : err);
  }
}

export { app, auth };
