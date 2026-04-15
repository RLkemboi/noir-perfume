import "dotenv/config";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { products } from "./data/products.js";

const app = new Hono();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:4173", "http://localhost:3000"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
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

// Cart (in-memory storage)
export type CartItem = {
  productId: string;
  name: string;
  brand: string;
  price: string;
  image: string;
  quantity: number;
};

const carts = new Map<string, CartItem[]>();

function parsePrice(price: string): number {
  return Number(price.replace(/[^0-9.]/g, "")) || 0;
}

function getCartTotals(items: CartItem[]) {
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const total = items.reduce((sum, i) => sum + parsePrice(i.price) * i.quantity, 0);
  return { count, total: Number(total.toFixed(2)) };
}

app.get("/api/cart/:sessionId", (c) => {
  const sessionId = c.req.param("sessionId");
  const items = carts.get(sessionId) || [];
  return c.json({ items, ...getCartTotals(items) });
});

app.post("/api/cart/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
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

  const current = carts.get(sessionId) || [];
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

  carts.set(sessionId, items);
  return c.json({ items, ...getCartTotals(items) });
});

app.put("/api/cart/:sessionId/:productId", async (c) => {
  const sessionId = c.req.param("sessionId");
  const productId = c.req.param("productId");
  let body: { quantity?: number };
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  }

  const current = carts.get(sessionId) || [];
  const qty = Math.max(0, Math.floor(body.quantity || 0));

  let items: CartItem[];
  if (qty === 0) {
    items = current.filter((i) => i.productId !== productId);
  } else {
    items = current.map((i) =>
      i.productId === productId ? { ...i, quantity: qty } : i
    );
  }

  carts.set(sessionId, items);
  return c.json({ items, ...getCartTotals(items) });
});

app.delete("/api/cart/:sessionId/:productId", (c) => {
  const sessionId = c.req.param("sessionId");
  const productId = c.req.param("productId");
  const current = carts.get(sessionId) || [];
  const items = current.filter((i) => i.productId !== productId);
  carts.set(sessionId, items);
  return c.json({ items, ...getCartTotals(items) });
});

app.delete("/api/cart/:sessionId", (c) => {
  const sessionId = c.req.param("sessionId");
  carts.delete(sessionId);
  return c.json({ items: [], count: 0, total: 0 });
});

// Checkout
interface Order {
  orderId: number;
  sessionId: string;
  items: CartItem[];
  total: number;
  createdAt: string;
}

const orders: Order[] = [];

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

  const order: Order = {
    orderId: orders.length + 1,
    sessionId,
    items: validatedItems,
    total: Number(total.toFixed(2)),
    createdAt: new Date().toISOString(),
  };

  orders.push(order);
  carts.delete(sessionId);

  return c.json({ success: true, orderId: order.orderId, total: order.total });
});

app.get("/api/orders", (c) => c.json({ orders, count: orders.length }));

app.get("/api/orders/session/:sessionId", (c) => {
  const sessionId = c.req.param("sessionId");
  const sessionOrders = orders.filter((o) => o.sessionId === sessionId);
  return c.json({ orders: sessionOrders, count: sessionOrders.length });
});

app.get("/api/orders/:orderId", (c) => {
  const orderId = Number(c.req.param("orderId"));
  if (!Number.isFinite(orderId)) {
    throw new HTTPException(400, { message: "Invalid order ID" });
  }
  const order = orders.find((o) => o.orderId === orderId);
  if (!order) throw new HTTPException(404, { message: "Order not found" });
  return c.json({ order });
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
