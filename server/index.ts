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
  const { sessionId, items } = body;

  if (!sessionId || !Array.isArray(items) || items.length === 0) {
    return c.json({ success: false, error: "Invalid checkout payload" }, 400);
  }

  let total = 0;
  const validatedItems: CartItem[] = [];

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) {
      return c.json({ success: false, error: `Unknown product: ${item.productId}` }, 400);
    }
    const qty = Math.max(1, Math.floor(item.quantity || 1));
    const price = Number(product.price.replace(/[^0-9.]/g, "")) || 0;
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
  const order = orders.find((o) => o.orderId === orderId);
  if (!order) return c.json({ error: "Order not found" }, 404);
  return c.json({ order });
});

const port = Number(process.env.PORT) || 3001;
console.log(`🖤 NOIR Server running at http://localhost:${port}`);
serve({ fetch: app.fetch, port });
