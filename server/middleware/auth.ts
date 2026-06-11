import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { auth } from "../db/firebase.js";
import { getUserProfile } from "../db/users.js";

function isAuthConfigurationMismatch(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes('incorrect "aud"') ||
    message.includes('incorrect "iss"') ||
    message.includes("Firebase ID token has invalid signature") ||
    message.includes("Firebase project")
  );
}

export const adminAuthMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  if (!auth) {
    throw new HTTPException(503, { message: "Auth service unavailable" });
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    const profile = await getUserProfile(decoded.uid, decoded.email);

    if (profile.role !== "Admin") {
      throw new HTTPException(403, { message: "Forbidden: Admin access required" });
    }

    await next();
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    if (isAuthConfigurationMismatch(err)) {
      throw new HTTPException(503, {
        message: "Authentication configuration mismatch between client and server. Rebuild the frontend with the correct Firebase web config and redeploy.",
      });
    }
    throw new HTTPException(401, { message: "Invalid token" });
  }
};
