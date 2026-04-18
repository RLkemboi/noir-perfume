import "dotenv/config";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { readFileSync } from "fs";
import { products } from "./data/products.js";
import type { CartItem } from "./types.js";
import { getCart, setCart, deleteCart } from "./db/carts.js";
import { createOrder, getOrdersBySession, getOrderById, getOrdersByUser } from "./db/orders.js";
import { auth } from "./db/firebase.js";

const app = new Hono();

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  console.error("[Server Error]", err);
  return c.json({ message: "Internal server error" }, 500);
});

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:4173", "http://localhost:3000"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Global error handler
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  console.error("[Server Error]", err);
  return c.json({ success: false, error: "Internal server error" }, 500);
});

// Health check
app.get("/api/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// Products
app.get("/api/products", (c) => c.json({ products, count: products.length }));

function parsePrice(price: string): number {
  return Number(price.replace(/[^0-9.]/g, "")) || 0;
}

function getCartTotals(items: CartItem[]) {
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const total = items.reduce((sum, i) => sum + parsePrice(i.price) * i.quantity, 0);
  return { count, total: Number(total.toFixed(2)) };
}

function isValidUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

app.get("/api/cart/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  if (!isValidUUID(sessionId)) {
    throw new HTTPException(400, { message: "Invalid session ID" });
  }
  const items = await getCart(sessionId);
  return c.json({ items, ...getCartTotals(items) });
});

app.post("/api/cart/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  if (!isValidUUID(sessionId)) {
    throw new HTTPException(400, { message: "Invalid session ID" });
  }
  let body: {
    productId: string;
    quantity?: number;
    name: string;
    brand: string;
    price: string;
    image: string;
  };
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  }

  const current = await getCart(sessionId);
  const existing = current.find((i) => i.productId === body.productId);
  const qty = Math.max(1, Math.floor(body.quantity || 1));

  let items: CartItem[];
  if (existing) {
    items = current.map((i) =>
      i.productId === body.productId ? { ...i, quantity: i.quantity + qty } : i
    );
  } else {
    items = [...current, { ...body, quantity: qty }];
  }

  await setCart(sessionId, items);
  return c.json({ items, ...getCartTotals(items) });
});

app.put("/api/cart/:sessionId/:productId", async (c) => {
  const sessionId = c.req.param("sessionId");
  if (!isValidUUID(sessionId)) {
    throw new HTTPException(400, { message: "Invalid session ID" });
  }
  const productId = c.req.param("productId");
  let body: { quantity?: number };
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  }

  const current = await getCart(sessionId);
  const qty = Math.max(0, Math.floor(body.quantity || 0));

  let items: CartItem[];
  if (qty === 0) {
    items = current.filter((i) => i.productId !== productId);
  } else {
    items = current.map((i) =>
      i.productId === productId ? { ...i, quantity: qty } : i
    );
  }

  await setCart(sessionId, items);
  return c.json({ items, ...getCartTotals(items) });
});

app.delete("/api/cart/:sessionId/:productId", async (c) => {
  const sessionId = c.req.param("sessionId");
  if (!isValidUUID(sessionId)) {
    throw new HTTPException(400, { message: "Invalid session ID" });
  }
  const productId = c.req.param("productId");
  const current = await getCart(sessionId);
  const items = current.filter((i) => i.productId !== productId);
  await setCart(sessionId, items);
  return c.json({ items, ...getCartTotals(items) });
});

app.delete("/api/cart/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  if (!isValidUUID(sessionId)) {
    throw new HTTPException(400, { message: "Invalid session ID" });
  }
  await deleteCart(sessionId);
  return c.json({ items: [], count: 0, total: 0 });
});

// Checkout
app.post("/api/checkout", async (c) => {
  let body: { sessionId: string; items: CartItem[] };
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  }
  const { sessionId, items } = body;

  if (!sessionId || !Array.isArray(items) || items.length === 0) {
    throw new HTTPException(400, { message: "Invalid checkout payload" });
  }

  let total = 0;
  const validatedItems: CartItem[] = [];

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) {
      throw new HTTPException(400, { message: `Unknown product: ${item.productId}` });
    }
    const qty = Math.max(1, Math.floor(item.quantity || 1));
    const price = parsePrice(product.price);
    total += price * qty;
    validatedItems.push({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      price: product.price,
      image: product.image,
      quantity: qty,
    });
  }

  // Verify Firebase token server-side to derive userId/userEmail securely
  let userId: string | undefined;
  let userEmail: string | undefined;
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (token && auth) {
    try {
      const decoded = await auth.verifyIdToken(token);
      userId = decoded.uid;
      userEmail = decoded.email || undefined;
    } catch {
      throw new HTTPException(401, { message: "Invalid authentication token" });
    }
  }

  const order = await createOrder(sessionId, validatedItems, Number(total.toFixed(2)), userId, userEmail);
  await deleteCart(sessionId);

  return c.json({ success: true, orderId: order.orderId, total: order.total });
});



app.get("/api/orders/session/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  if (!isValidUUID(sessionId)) {
    throw new HTTPException(400, { message: "Invalid session ID" });
  }
  try {
    const orders = await getOrdersBySession(sessionId);
    return c.json({ orders, count: orders.length });
  } catch {
    throw new HTTPException(500, { message: "Unable to load orders. Please try again later." });
  }
});

app.get("/api/orders/:orderId", async (c) => {
  const orderId = Number(c.req.param("orderId"));
  if (!Number.isFinite(orderId)) {
    throw new HTTPException(400, { message: "Invalid order ID" });
  }
  const order = await getOrderById(orderId);
  if (!order) throw new HTTPException(404, { message: "Order not found" });
  return c.json({ order });
});

app.get("/api/orders/me", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  const idToken = authHeader.slice(7);
  let decoded;
  try {
    if (!auth) {
      throw new HTTPException(503, { message: "Auth service unavailable" });
    }
    decoded = await auth.verifyIdToken(idToken);
  } catch {
    throw new HTTPException(401, { message: "Invalid token" });
  }
  try {
    const orders = await getOrdersByUser(decoded.uid);
    return c.json({ orders, count: orders.length });
  } catch {
    throw new HTTPException(500, { message: "Unable to load orders. Please try again later." });
  }
});

// Serve built frontend assets
app.use("*", serveStatic({ root: "./dist" }));

// API 404 handler
app.notFound((c) => {
  if (c.req.path.startsWith("/api/")) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.html(readFileSync("./dist/index.html", "utf-8"));
});

const port = Number(process.env.PORT) || 3001;
const server: ServerType = serve({ fetch: app.fetch, port });
console.log(`🖤 NOIR Server running at http://localhost:${port}`);

const shutdown = (signal: string) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
