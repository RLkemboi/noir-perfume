import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;

try {
  const hasConfig = firebaseConfig.apiKey && firebaseConfig.projectId;
  if (hasConfig) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  } else if (import.meta.env.DEV) {
    console.warn("[Firebase] Client config missing. Auth features will be unavailable.");
  }
} catch (err) {
  if (import.meta.env.DEV) {
    console.warn("[Firebase] Initialization failed:", err instanceof Error ? err.message : err);
  }
}

export { app, auth };
