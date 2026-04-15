import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { products } from "./data/products.js";

const app = new Hono();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:4173", "http://localhost:3000"],
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    credentials: true,
  })
);

// Health check
app.get("/api/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// Products
app.get("/api/products", (c) => c.json({ products, count: products.length }));

// Cart (in-memory storage)
type CartItem = {
  productId: string;
  name: string;
  brand: string;
  price: string;
  image: string;
  quantity: number;
};

const carts = new Map<string, CartItem[]>();

app.get("/api/cart/:sessionId", (c) => {
  const sessionId = c.req.param("sessionId");
  const items = carts.get(sessionId) || [];
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const total = items.reduce((sum, i) => {
    const val = Number(i.price.replace(/[^0-9.]/g, "")) || 0;
    return sum + val * i.quantity;
  }, 0);
  return c.json({ items, count, total: Number(total.toFixed(2)) });
});

app.post("/api/cart/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  const body = await c.req.json<{
    productId: string;
    quantity?: number;
    name: string;
    brand: string;
    price: string;
    image: string;
  }>();

  const items = carts.get(sessionId) || [];
  const existing = items.find((i) => i.productId === body.productId);

  if (existing) {
    existing.quantity += body.quantity || 1;
  } else {
    items.push({ ...body, quantity: body.quantity || 1 });
  }

  carts.set(sessionId, items);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  return c.json({ items, count });
});

app.delete("/api/cart/:sessionId/:productId", (c) => {
  const sessionId = c.req.param("sessionId");
  const productId = c.req.param("productId");
  let items = carts.get(sessionId) || [];
  items = items.filter((i) => i.productId !== productId);
  carts.set(sessionId, items);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  return c.json({ items, count });
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
  const body = await c.req.json<{ sessionId: string; items: CartItem[] }>();
  const total = body.items.reduce((sum, i) => {
    const val = Number(i.price.replace(/[^0-9.]/g, "")) || 0;
    return sum + val * i.quantity;
  }, 0);

  const order: Order = {
    orderId: orders.length + 1,
    sessionId: body.sessionId,
    items: body.items,
    total: Number(total.toFixed(2)),
    createdAt: new Date().toISOString(),
  };

  orders.push(order);
  carts.delete(body.sessionId);

  return c.json({ success: true, orderId: order.orderId, total: order.total });
});

app.get("/api/orders", (c) => c.json({ orders, count: orders.length }));

const port = Number(process.env.PORT) || 3001;
console.log(`🖤 NOIR Server running at http://localhost:${port}`);
serve({ fetch: app.fetch, port });
