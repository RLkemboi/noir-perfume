import "dotenv/config";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import type { Context, Next } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { readFileSync } from "fs";
import { products } from "./data/products.js";
import type { CartItem, Order, OrderStatus, PaymentMethod, ShippingDetails, UserRole, UserTier } from "./types.js";
import { getCart, setCart, deleteCart } from "./db/carts.js";
import { 
  createOrder, 
  getOrders, 
  getOrdersBySession, 
  getOrderById, 
  getOrdersByUser, 
  updateOrderStatus, 
  updateOrderComment,
  getShippedOrders, 
  assignOrderToAgent, 
  getAgentOrders,
  confirmAgentDelivery,
  confirmCustomerDelivery,
  confirmAdminDelivery,
  getOrderByMpesaCheckoutRequestId,
  requestPaymentPrompt,
  recordOrderPayment,
  updateOrderPaymentMeta
} from "./db/orders.js";
import { adjustUserAccountBalance, getUserProfile, updateUserSpent, getPendingStaff, approveStaff, registerStaffApplication, getStaffMembers, updateStaffProfile } from "./db/users.js";
import { auth } from "./db/firebase.js";
import { initiateMpesaStkPush, normalizeMpesaPhone } from "./mpesa.js";

const app = new Hono();

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  console.error("[Server Error]", err);
  return c.json({ message: "Internal server error" }, 500);
});

app.use("*", async (c, next) => {
  c.header("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  await next();
});

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:4173", "http://localhost:3000"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Health check
app.get("/api/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// Products
app.get("/api/products", (c) => c.json({ products, count: products.length }));

app.get("/api/products/:id", (c) => {
  const id = c.req.param("id");
  const product = products.find((p) => p.id === id);
  if (!product) throw new HTTPException(404, { message: "Product not found" });
  return c.json({ product });
});

function parsePrice(price: string): number {
  return Number(price.replace(/[^0-9.]/g, "")) || 0;
}

function getCartTotals(items: CartItem[]) {
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const total = items.reduce((sum, i) => sum + parsePrice(i.price) * i.quantity, 0);
  return { count, total: Number(total.toFixed(2)) };
}

async function getAuthenticatedUser(c: Context) {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token || !auth) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  try {
    return await auth.verifyIdToken(token);
  } catch {
    throw new HTTPException(401, { message: "Invalid token" });
  }
}

async function ensureOrderAccess(c: Context, order: Order) {
  const sessionId = c.req.query("sessionId") || "";

  if (order.userId) {
    const decoded = await getAuthenticatedUser(c);
    if (decoded.uid !== order.userId) {
      throw new HTTPException(403, { message: "Forbidden" });
    }
    return decoded;
  }

  if (!isValidUUID(sessionId) || sessionId !== order.sessionId) {
    throw new HTTPException(403, { message: "Forbidden" });
  }

  return null;
}

function isValidUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

const PAY_ON_DELIVERY_LIMITS: Record<UserTier, number> = {
  Junior: 0,
  Bronze: 250,
  Silver: 250,
  Gold: 600,
  Platinum: 1200,
  Diamond: 2500,
  "The Alchemist Circle": 5000,
};

function getPayOnDeliveryLimit(tier: UserTier): number {
  return PAY_ON_DELIVERY_LIMITS[tier] ?? 0;
}

function isAccountBalanceTier(tier: UserTier): boolean {
  return ["Silver", "Gold", "Platinum", "Diamond", "The Alchemist Circle"].includes(tier);
}

function isBronzeDepositTier(tier: UserTier): boolean {
  return tier === "Bronze";
}

function estimateCogsRatio(collection?: string): number {
  if (collection === "Archive") return 0.48;
  if (collection === "Limited") return 0.43;
  return 0.38;
}

function getShippedAt(order: Order): string | undefined {
  return order.statusHistory.find((entry) => entry.status === "Shipped")?.date;
}

function getOrderFinancials(order: Order) {
  const recognizedExpense = Number(
    order.items
      .reduce((sum, item) => {
        const product = products.find((p) => p.id === item.productId);
        const unitPrice = parsePrice(item.price);
        return sum + unitPrice * estimateCogsRatio(product?.collection) * item.quantity;
      }, 0)
      .toFixed(2)
  );

  const isCancelled = order.status === "Cancelled";
  const isDelivered = order.status === "Delivered";
  const isExpenseRecognized = Boolean(getShippedAt(order));
  const realizedRevenue = Number((order.paymentHistory || []).reduce((sum, entry) => sum + entry.amount, 0).toFixed(2));
  const isRealized = !isCancelled && order.paymentStatus === "Paid";

  return {
    recognizedExpense: isExpenseRecognized ? recognizedExpense : 0,
    estimatedProfit: Number((realizedRevenue - (isExpenseRecognized ? recognizedExpense : 0)).toFixed(2)),
    isCancelled,
    isDelivered,
    isRealized,
    isCodPending: !isCancelled && order.paymentMethod === "PayOnDelivery" && !order.adminDeliveryConfirmed,
    realizedRevenue,
    isExpenseRecognized,
  };
}

function buildFinancialSummary(orders: Awaited<ReturnType<typeof getOrders>>) {
  const activeOrders = orders.filter((order) => order.status !== "Cancelled");
  const bookedRevenue = activeOrders.reduce((sum, order) => sum + order.total, 0);
  const cancelledRevenue = orders
    .filter((order) => order.status === "Cancelled")
    .reduce((sum, order) => sum + order.total, 0);
  const deliveredOrders = orders.filter((order) => order.status === "Delivered");
  const realizedRevenue = activeOrders.reduce((sum, order) => sum + getOrderFinancials(order).realizedRevenue, 0);
  const outstandingCod = activeOrders
    .filter((order) => getOrderFinancials(order).isCodPending)
    .reduce((sum, order) => sum + order.amountDue, 0);
  const openPipelineRevenue = activeOrders
    .filter((order) => order.status !== "Delivered")
    .reduce((sum, order) => sum + order.total, 0);
  const totalEstimatedCogs = activeOrders.reduce((sum, order) => sum + getOrderFinancials(order).recognizedExpense, 0);
  const estimatedGrossProfit = bookedRevenue - totalEstimatedCogs;
  const operatingNetWorth = Number((realizedRevenue - totalEstimatedCogs - cancelledRevenue).toFixed(2));
  const averageOrderValue = activeOrders.length ? bookedRevenue / activeOrders.length : 0;
  const deliveryCompletionRate = activeOrders.length ? deliveredOrders.length / activeOrders.length : 0;
  const payOnDeliveryOrders = activeOrders.filter((order) => order.paymentMethod === "PayOnDelivery");
  const cardOrders = activeOrders.filter((order) => order.paymentMethod === "Card");
  const unpaidCodOrders = payOnDeliveryOrders.filter((order) => order.paymentStatus === "Unpaid");
  const partialCodOrders = payOnDeliveryOrders.filter((order) => order.paymentStatus === "Partial");
  const paidCodOrders = payOnDeliveryOrders.filter((order) => order.paymentStatus === "Paid");
  const promptRequestedOrders = payOnDeliveryOrders.filter((order) => (order.paymentPromptCount || 0) > 0);
  const ratedOrders = activeOrders.filter((order) => typeof order.reviewRating === "number");
  const averageReviewRating = ratedOrders.length
    ? ratedOrders.reduce((sum, order) => sum + (order.reviewRating || 0), 0) / ratedOrders.length
    : 0;
  const unitsSold = activeOrders.reduce((sum, order) => sum + order.items.reduce((inner, item) => inner + item.quantity, 0), 0);
  const resolveWeek = (isoDate: string) => {
    const date = new Date(isoDate);
    const weekStart = new Date(date);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    const key = weekStart.toISOString();
    const label = weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return { key, label, weekStart };
  };

  const weeklyMap = new Map<string, {
    label: string;
    bookedRevenue: number;
    realizedRevenue: number;
    recognizedExpense: number;
    weeklyProfit: number;
    netWorth: number;
  }>();

  for (const order of orders) {
    const financials = getOrderFinancials(order);

    if (!financials.isCancelled) {
      const createdWeek = resolveWeek(order.createdAt);
      const createdBucket = weeklyMap.get(createdWeek.key) ?? { label: createdWeek.label, bookedRevenue: 0, realizedRevenue: 0, recognizedExpense: 0, weeklyProfit: 0, netWorth: 0 };
      createdBucket.bookedRevenue += order.total;
      weeklyMap.set(createdWeek.key, createdBucket);

      for (const payment of order.paymentHistory || []) {
        const paymentWeek = resolveWeek(payment.date);
        const paymentBucket = weeklyMap.get(paymentWeek.key) ?? { label: paymentWeek.label, bookedRevenue: 0, realizedRevenue: 0, recognizedExpense: 0, weeklyProfit: 0, netWorth: 0 };
        paymentBucket.realizedRevenue += payment.amount;
        weeklyMap.set(paymentWeek.key, paymentBucket);
      }

      const shippedAt = getShippedAt(order);
      if (shippedAt && financials.recognizedExpense > 0) {
        const expenseWeek = resolveWeek(shippedAt);
        const expenseBucket = weeklyMap.get(expenseWeek.key) ?? { label: expenseWeek.label, bookedRevenue: 0, realizedRevenue: 0, recognizedExpense: 0, weeklyProfit: 0, netWorth: 0 };
        expenseBucket.recognizedExpense += financials.recognizedExpense;
        weeklyMap.set(expenseWeek.key, expenseBucket);
      }
    }
  }

  const sortedWeekKeys = Array.from(weeklyMap.keys()).sort((a, b) => (a < b ? -1 : 1));
  const latestWeekStart = sortedWeekKeys.length > 0
    ? new Date(sortedWeekKeys[sortedWeekKeys.length - 1])
    : resolveWeek(new Date().toISOString()).weekStart;
  const weeklyWindow = Array.from({ length: 8 }, (_, index) => {
    const weekStart = new Date(latestWeekStart);
    weekStart.setDate(latestWeekStart.getDate() - (7 - index) * 7);
    weekStart.setHours(0, 0, 0, 0);
    return {
      key: weekStart.toISOString(),
      label: weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    };
  });

  let cumulativeNetWorth = 0;
  let previousEstimatedProfit: number | null = null;
  const weeklyTrend = weeklyWindow.map(({ key, label }, index) => {
      const week = weeklyMap.get(key);
      if (!week) {
        return {
          label,
          bookedRevenue: 0,
          realizedRevenue: 0,
          recognizedExpense: 0,
          estimatedProfit: 0,
          netWorth: Number(cumulativeNetWorth.toFixed(2)),
          direction: "flat" as const,
          trendColor: "red" as const,
        };
      }

      week.weeklyProfit = Number((week.realizedRevenue - week.recognizedExpense).toFixed(2));
      cumulativeNetWorth += week.weeklyProfit;
      week.netWorth = Number(cumulativeNetWorth.toFixed(2));
      const direction = previousEstimatedProfit == null ? "flat" : week.weeklyProfit >= previousEstimatedProfit ? "up" : "down";
      const trendColor = index === 0 || previousEstimatedProfit == null || week.weeklyProfit <= previousEstimatedProfit ? "red" : "green";
      previousEstimatedProfit = week.weeklyProfit;

      return {
        ...week,
        bookedRevenue: Number(week.bookedRevenue.toFixed(2)),
        realizedRevenue: Number(week.realizedRevenue.toFixed(2)),
        recognizedExpense: Number(week.recognizedExpense.toFixed(2)),
        estimatedProfit: Number(week.weeklyProfit.toFixed(2)),
        netWorth: Number(week.netWorth.toFixed(2)),
        direction,
        trendColor,
      };
    });

  return {
    totalRevenue: Number(bookedRevenue.toFixed(2)),
    orderCount: activeOrders.length,
    bookedRevenue: Number(bookedRevenue.toFixed(2)),
    realizedRevenue: Number(realizedRevenue.toFixed(2)),
    cancelledRevenue: Number(cancelledRevenue.toFixed(2)),
    outstandingCod: Number(outstandingCod.toFixed(2)),
    openPipelineRevenue: Number(openPipelineRevenue.toFixed(2)),
    estimatedGrossProfit: Number(estimatedGrossProfit.toFixed(2)),
    operatingNetWorth,
    averageOrderValue: Number(averageOrderValue.toFixed(2)),
    grossMargin: bookedRevenue ? Number(((estimatedGrossProfit / bookedRevenue) * 100).toFixed(1)) : 0,
    deliveryCompletionRate: Number((deliveryCompletionRate * 100).toFixed(1)),
    activeOrders: activeOrders.length,
    deliveredOrders: deliveredOrders.length,
    unitsSold,
    payOnDeliveryOrders: payOnDeliveryOrders.length,
    unpaidCodOrders: unpaidCodOrders.length,
    partialCodOrders: partialCodOrders.length,
    paidCodOrders: paidCodOrders.length,
    promptRequestedOrders: promptRequestedOrders.length,
    cardOrders: cardOrders.length,
    ratedOrders: ratedOrders.length,
    averageReviewRating: Number(averageReviewRating.toFixed(1)),
    recentSales: activeOrders.slice(-10).reverse(),
    weeklyTrend,
  };
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
  let body: { sessionId: string; items: CartItem[]; shipping?: ShippingDetails; paymentMethod?: PaymentMethod; paymentPhone?: string };
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  }
  const { sessionId, items, shipping, paymentMethod = "Card", paymentPhone } = body;

  if (!sessionId || !isValidUUID(sessionId) || !Array.isArray(items) || items.length === 0) {
    throw new HTTPException(400, { message: "Invalid checkout payload" });
  }
  if (paymentMethod !== "Card" && paymentMethod !== "PayOnDelivery" && paymentMethod !== "Mpesa") {
    throw new HTTPException(400, { message: "Invalid payment method" });
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
  let customerProfile: Awaited<ReturnType<typeof getUserProfile>> | undefined;
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (token) {
    if (!auth) {
      throw new HTTPException(503, { message: "Auth service unavailable. Please try again later." });
    }
    try {
      const decoded = await auth.verifyIdToken(token);
      userId = decoded.uid;
      userEmail = decoded.email || undefined;
    } catch {
      throw new HTTPException(401, { message: "Invalid authentication token" });
    }
  }

  if (userId) {
    customerProfile = await getUserProfile(userId, userEmail);
  }

  let payOnDeliveryLimit: number | undefined;
  let initialAmountPaid: number | undefined;
  let paymentReference: string | undefined;
  let paymentPromptCount: number | undefined;
  let paymentPromptRequestedAt: string | undefined;
  let accountBalanceDelta = 0;
  let settledAtCheckoutAmount = 0;

  if (paymentMethod === "PayOnDelivery") {
    if (!userId || !customerProfile) {
      throw new HTTPException(403, { message: "Pay on delivery is only available to signed-in members." });
    }
    payOnDeliveryLimit = getPayOnDeliveryLimit(customerProfile.tier);
    if (customerProfile.tier === "Junior" || payOnDeliveryLimit <= 0) {
      throw new HTTPException(403, { message: "Junior members do not yet have pay-on-delivery access." });
    }
    if (Number(total.toFixed(2)) > payOnDeliveryLimit) {
      throw new HTTPException(403, { message: `Your ${customerProfile.tier} tier pay-on-delivery limit is $${payOnDeliveryLimit.toFixed(2)}.` });
    }

    if (isBronzeDepositTier(customerProfile.tier)) {
      initialAmountPaid = Number((total * 0.5).toFixed(2));
      settledAtCheckoutAmount = initialAmountPaid;
      paymentReference = "BRONZE-50PCT-DEPOSIT";
      paymentPromptCount = 0;
    } else if (isAccountBalanceTier(customerProfile.tier)) {
      initialAmountPaid = Number(total.toFixed(2));
      settledAtCheckoutAmount = initialAmountPaid;
      accountBalanceDelta = -initialAmountPaid;
      paymentReference = (customerProfile.accountBalance ?? 0) >= total ? "ACCOUNT_BALANCE" : "ACCOUNT_CREDIT";
      paymentPromptCount = 0;
      paymentPromptRequestedAt = undefined;
    }
  }

  let normalizedPaymentPhone: string | undefined;
  if (paymentMethod === "Mpesa") {
    const candidatePhone = paymentPhone || shipping?.phone;
    if (!candidatePhone) {
      throw new HTTPException(400, { message: "An M-Pesa phone number is required for STK push." });
    }
    try {
      normalizedPaymentPhone = normalizeMpesaPhone(candidatePhone);
    } catch (err) {
      throw new HTTPException(400, { message: err instanceof Error ? err.message : "Invalid M-Pesa phone number." });
    }
  }

  const order = await createOrder(
    sessionId,
    validatedItems,
    Number(total.toFixed(2)),
    userId,
    userEmail,
    shipping,
    paymentMethod,
    paymentMethod === "PayOnDelivery" ? payOnDeliveryLimit : undefined,
    normalizedPaymentPhone,
    {
      initialAmountPaid,
      paymentReference,
      paymentPromptCount,
      paymentPromptRequestedAt,
    }
  );

  if (paymentMethod === "Mpesa" && normalizedPaymentPhone) {
    try {
      const stk = await initiateMpesaStkPush({
        amount: order.total,
        phoneNumber: normalizedPaymentPhone,
        accountReference: `ORDER-${order.orderId}`,
        transactionDesc: `Noir Perfume order ${order.orderId}`,
      });

      await updateOrderPaymentMeta(order.orderId, {
        paymentPhone: normalizedPaymentPhone,
        paymentRequestedAt: new Date().toISOString(),
        paymentLastError: undefined,
        mpesaMerchantRequestId: stk.merchantRequestId,
        mpesaCheckoutRequestId: stk.checkoutRequestId,
      });
      await deleteCart(sessionId);

      return c.json({
        success: true,
        orderId: order.orderId,
        total: order.total,
        mpesa: {
          checkoutRequestId: stk.checkoutRequestId,
          customerMessage: stk.customerMessage,
          mock: stk.mock,
        },
      });
    } catch (err) {
      await updateOrderPaymentMeta(order.orderId, {
        paymentPhone: normalizedPaymentPhone,
        paymentRequestedAt: new Date().toISOString(),
        paymentLastError: err instanceof Error ? err.message : "M-Pesa STK push failed.",
      });
      throw new HTTPException(502, { message: err instanceof Error ? err.message : "M-Pesa STK push failed." });
    }
  }

  await deleteCart(sessionId);

  if (paymentMethod === "PayOnDelivery" && userId && accountBalanceDelta !== 0) {
    await adjustUserAccountBalance(userId, accountBalanceDelta);
  }

  if (userId && paymentMethod !== "Mpesa") {
    const spendAmount = paymentMethod === "PayOnDelivery" ? settledAtCheckoutAmount : order.total;
    if (spendAmount > 0) {
      await updateUserSpent(userId, spendAmount);
    }
  }

  return c.json({ success: true, orderId: order.orderId, total: order.total });
  });

  app.get("/api/user/profile", async (c) => {
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
    return c.json({ profile });
  } catch {
    throw new HTTPException(401, { message: "Invalid token" });
  }
  });

  app.post("/api/user/account/deposit", async (c) => {
    const decoded = await getAuthenticatedUser(c);

    let body: { amount: number };
    try {
      body = await c.req.json();
    } catch {
      throw new HTTPException(400, { message: "Invalid deposit body" });
    }

    if (!Number.isFinite(body.amount) || body.amount <= 0) {
      throw new HTTPException(400, { message: "Deposit amount must be greater than zero." });
    }

    // TODO: Replace this simplified balance mutation with a proper account ledger.
    const profile = await adjustUserAccountBalance(decoded.uid, Number(body.amount.toFixed(2)));
    return c.json({ success: true, profile });
  });

  // Simulation: Advance order status
  app.post("/api/orders/:orderId/advance", async (c) => {
  const orderId = Number(c.req.param("orderId"));
  const order = await getOrderById(orderId);
  if (!order) throw new HTTPException(404, { message: "Order not found" });

  const statuses: OrderStatus[] = ["Pending", "Processing", "Shipped", "Out for Delivery", "Delivered"];
  const currentIndex = statuses.indexOf(order.status);

  if (currentIndex === -1 || currentIndex === statuses.length - 1) {
    return c.json({ order, message: "Order already delivered or in unknown state" });
  }

  const nextStatus = statuses[currentIndex + 1];
  if (!nextStatus) {
    return c.json({ order, message: "No next status available" });
  }
  const updatedOrder = await updateOrderStatus(orderId, nextStatus);

  return c.json({ order: updatedOrder });
  });

  app.post("/api/orders/:orderId/comment", async (c) => {
    const orderId = Number(c.req.param("orderId"));
    const body = await c.req.json();
    const { comment, reviewRating } = body;
    const order = await getOrderById(orderId);
    if (!order) throw new HTTPException(404, { message: "Order not found" });

    if (!comment || typeof comment !== "string") {
      throw new HTTPException(400, { message: "Comment is required" });
    }
    if (!Number.isInteger(reviewRating) || reviewRating < 1 || reviewRating > 5) {
      throw new HTTPException(400, { message: "A star rating between 1 and 5 is required" });
    }
    if (order.status !== "Delivered") {
      throw new HTTPException(400, { message: "Reviews can only be left on delivered orders." });
    }

    const authHeader = c.req.header("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const sessionId = c.req.query("sessionId") || "";

    if (order.userId) {
      if (!token || !auth) throw new HTTPException(401, { message: "Unauthorized" });
      const decoded = await auth.verifyIdToken(token);
      if (decoded.uid !== order.userId) throw new HTTPException(403, { message: "Forbidden" });
    } else if (!isValidUUID(sessionId) || sessionId !== order.sessionId) {
      throw new HTTPException(403, { message: "Forbidden" });
    }

    const updatedOrder = await updateOrderComment(orderId, comment, reviewRating);
    if (!updatedOrder) throw new HTTPException(404, { message: "Order not found" });

    return c.json({ success: true, order: updatedOrder });
  });

  app.post("/api/orders/:orderId/request-payment-prompt", async (c) => {
    const orderId = Number(c.req.param("orderId"));
    const order = await getOrderById(orderId);
    if (!order) throw new HTTPException(404, { message: "Order not found" });
    if (order.paymentMethod !== "PayOnDelivery") {
      throw new HTTPException(400, { message: "Payment prompts apply only to pay-on-delivery orders." });
    }

    const authHeader = c.req.header("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const sessionId = c.req.query("sessionId") || "";

    if (order.userId) {
      if (!token || !auth) throw new HTTPException(401, { message: "Unauthorized" });
      const decoded = await auth.verifyIdToken(token);
      if (decoded.uid !== order.userId) throw new HTTPException(403, { message: "Forbidden" });
    } else if (!isValidUUID(sessionId) || sessionId !== order.sessionId) {
      throw new HTTPException(403, { message: "Forbidden" });
    }

    if (order.amountDue <= 0) {
      throw new HTTPException(400, { message: "This delivery order has no remaining balance." });
    }

    const updated = await requestPaymentPrompt(orderId);
    return c.json({ success: true, order: updated, message: "Payment prompt requested." });
  });

  app.post("/api/orders/:orderId/pay", async (c) => {
    const orderId = Number(c.req.param("orderId"));
    const order = await getOrderById(orderId);
    if (!order) throw new HTTPException(404, { message: "Order not found" });
    if (order.paymentMethod !== "PayOnDelivery") {
      throw new HTTPException(400, { message: order.paymentMethod === "Mpesa" ? "Use M-Pesa STK push for this order." : "This order was already paid by card." });
    }

    let body: { amount: number };
    try {
      body = await c.req.json();
    } catch {
      throw new HTTPException(400, { message: "Invalid payment body" });
    }

    const access = await ensureOrderAccess(c, order);
    if (!Number.isFinite(body.amount) || body.amount <= 0) {
      throw new HTTPException(400, { message: "Payment amount must be greater than zero." });
    }
    if (body.amount > order.amountDue) {
      throw new HTTPException(400, { message: "Payment amount exceeds the remaining balance." });
    }
    if (Number(body.amount.toFixed(2)) !== Number(order.amountDue.toFixed(2))) {
      throw new HTTPException(400, { message: "Delivery orders now require settling the full remaining balance at once." });
    }

    const settledAmount = Number(order.amountDue.toFixed(2));
    const updated = await recordOrderPayment(orderId, settledAmount);
    if (updated?.userId) {
      await updateUserSpent(updated.userId, settledAmount);
    } else if (access && "uid" in access) {
      await updateUserSpent(access.uid, settledAmount);
    }
    return c.json({ success: true, order: updated });
  });

  app.post("/api/orders/:orderId/mpesa-stk", async (c) => {
    const orderId = Number(c.req.param("orderId"));
    const order = await getOrderById(orderId);
    if (!order) throw new HTTPException(404, { message: "Order not found" });
    if (order.paymentMethod !== "Mpesa") {
      throw new HTTPException(400, { message: "This order was not created for M-Pesa payment." });
    }
    if (order.amountDue <= 0) {
      throw new HTTPException(400, { message: "This order has already been paid." });
    }

    await ensureOrderAccess(c, order);

    let body: { phoneNumber?: string };
    try {
      body = await c.req.json();
    } catch {
      body = {};
    }

    const candidatePhone = body.phoneNumber || order.paymentPhone || order.shipping?.phone;
    if (!candidatePhone) {
      throw new HTTPException(400, { message: "Provide a valid M-Pesa phone number to send the STK push." });
    }

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizeMpesaPhone(candidatePhone);
    } catch (err) {
      throw new HTTPException(400, { message: err instanceof Error ? err.message : "Invalid M-Pesa phone number." });
    }

    try {
      const stk = await initiateMpesaStkPush({
        amount: order.amountDue,
        phoneNumber: normalizedPhone,
        accountReference: `ORDER-${order.orderId}`,
        transactionDesc: `Balance for Noir Perfume order ${order.orderId}`,
      });

      const updated = await updateOrderPaymentMeta(order.orderId, {
        paymentPhone: normalizedPhone,
        paymentRequestedAt: new Date().toISOString(),
        paymentLastError: undefined,
        mpesaMerchantRequestId: stk.merchantRequestId,
        mpesaCheckoutRequestId: stk.checkoutRequestId,
      });

      return c.json({
        success: true,
        order: updated,
        mpesa: {
          checkoutRequestId: stk.checkoutRequestId,
          customerMessage: stk.customerMessage,
          mock: stk.mock,
        },
      });
    } catch (err) {
      await updateOrderPaymentMeta(order.orderId, {
        paymentPhone: normalizedPhone,
        paymentRequestedAt: new Date().toISOString(),
        paymentLastError: err instanceof Error ? err.message : "M-Pesa STK push failed.",
      });

      throw new HTTPException(502, { message: err instanceof Error ? err.message : "M-Pesa STK push failed." });
    }
  });

  app.post("/api/payments/mpesa/callback", async (c) => {
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
    const callback = ((body as {
      Body?: {
        stkCallback?: {
          CheckoutRequestID?: string;
          MerchantRequestID?: string;
          ResultCode?: number;
          ResultDesc?: string;
          CallbackMetadata?: { Item?: Array<{ Name?: string; Value?: string | number }> };
        };
      };
    }).Body?.stkCallback);

    if (!callback?.CheckoutRequestID) {
      throw new HTTPException(400, { message: "Invalid M-Pesa callback payload." });
    }

    const order = await getOrderByMpesaCheckoutRequestId(callback.CheckoutRequestID);
    if (!order) {
      return c.json({ success: true, ignored: true });
    }

    const metadata = callback.CallbackMetadata?.Item || [];
    const findValue = (name: string) => metadata.find((entry) => entry.Name === name)?.Value;

    if (callback.ResultCode === 0) {
      const amount = Number(findValue("Amount") || order.amountDue || order.total);
      const receiptNumber = String(findValue("MpesaReceiptNumber") || "");
      const phoneNumber = String(findValue("PhoneNumber") || order.paymentPhone || "");

      if ((receiptNumber && order.mpesaReceiptNumber === receiptNumber) || order.amountDue <= 0) {
        return c.json({ success: true, duplicate: true });
      }

      const wasUnpaid = order.amountDue > 0;
      const updated = await recordOrderPayment(order.orderId, Number(amount.toFixed(2)), "mpesa_stk");
      if (updated) {
        await updateOrderPaymentMeta(order.orderId, {
          paymentPhone: phoneNumber || order.paymentPhone,
          paymentReference: receiptNumber || updated.paymentReference,
          mpesaReceiptNumber: receiptNumber || updated.mpesaReceiptNumber,
          paymentLastError: undefined,
          mpesaMerchantRequestId: callback.MerchantRequestID || updated.mpesaMerchantRequestId,
          mpesaCheckoutRequestId: callback.CheckoutRequestID || updated.mpesaCheckoutRequestId,
        });
      }

      if (wasUnpaid && order.userId) {
        await updateUserSpent(order.userId, Number(amount.toFixed(2)));
      }

      return c.json({ success: true });
    }

    await updateOrderPaymentMeta(order.orderId, {
      paymentLastError: callback.ResultDesc || "M-Pesa payment failed.",
      mpesaMerchantRequestId: callback.MerchantRequestID || order.mpesaMerchantRequestId,
      mpesaCheckoutRequestId: callback.CheckoutRequestID || order.mpesaCheckoutRequestId,
    });

    return c.json({ success: true });
  });

  // Staff: Get orders ready for pickup/delivery (Shipped)
  app.get("/api/staff/available-orders", async (c) => {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token || !auth) throw new HTTPException(401, { message: "Unauthorized" });

  try {
    const decoded = await auth.verifyIdToken(token);
    const profile = await getUserProfile(decoded.uid);
    if (profile.role !== "DeliveryAgent" && profile.role !== "Manager") {
      throw new HTTPException(403, { message: "Forbidden" });
    }
    const orders = await getShippedOrders();
    return c.json({ orders });
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    throw new HTTPException(401, { message: "Invalid token" });
  }
  });

  // Staff: Accept order for delivery
  app.post("/api/staff/orders/:orderId/accept", async (c) => {
  const orderId = Number(c.req.param("orderId"));
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token || !auth) throw new HTTPException(401, { message: "Unauthorized" });

  try {
    const decoded = await auth.verifyIdToken(token);
    const profile = await getUserProfile(decoded.uid);
    if (profile.role !== "DeliveryAgent") {
      throw new HTTPException(403, { message: "Only delivery agents can accept orders" });
    }

    const order = await getOrderById(orderId);
    if (!order) throw new HTTPException(404, { message: "Order not found" });
    if (order.status !== "Shipped") {
      throw new HTTPException(400, { message: "Order is not ready for delivery (must be 'Shipped')" });
    }

    // Assigning to agent auto-updates status to "Out for Delivery"
    const updated = await assignOrderToAgent(orderId, decoded.uid, decoded.displayName || decoded.email || "Agent");
    return c.json({ order: updated });
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    throw new HTTPException(401, { message: "Invalid token" });
  }
  });

  // Staff: Mark order as delivered
  app.post("/api/staff/orders/:orderId/deliver", async (c) => {
    const orderId = Number(c.req.param("orderId"));
    const authHeader = c.req.header("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token || !auth) throw new HTTPException(401, { message: "Unauthorized" });

    try {
      const decoded = await auth.verifyIdToken(token);
      const profile = await getUserProfile(decoded.uid);
      if (profile.role !== "DeliveryAgent") {
        throw new HTTPException(403, { message: "Unauthorized role" });
      }

      const order = await getOrderById(orderId);
      if (!order) throw new HTTPException(404, { message: "Order not found" });
      if (order.assignedAgentId !== decoded.uid) {
        throw new HTTPException(403, { message: "You are not the assigned agent for this order" });
      }
      if (order.status !== "Out for Delivery") {
        throw new HTTPException(400, { message: "Order must be out for delivery before it can be confirmed." });
      }

      const updated = await confirmAgentDelivery(orderId);

      return c.json({ order: updated });
    } catch (err) {
      if (err instanceof HTTPException) throw err;
      throw new HTTPException(401, { message: "Invalid token" });
    }
  });

  app.post("/api/orders/:orderId/customer-confirm", async (c) => {
    const orderId = Number(c.req.param("orderId"));
    if (!Number.isFinite(orderId)) {
      throw new HTTPException(400, { message: "Invalid order ID" });
    }

    const order = await getOrderById(orderId);
    if (!order) throw new HTTPException(404, { message: "Order not found" });
    if (order.status !== "Delivered") {
      throw new HTTPException(400, { message: "You can only confirm receipt after delivery has been marked complete." });
    }

    const authHeader = c.req.header("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const sessionId = c.req.query("sessionId") || "";

    if (order.userId) {
      if (!token || !auth) throw new HTTPException(401, { message: "Unauthorized" });
      let decoded;
      try {
        decoded = await auth.verifyIdToken(token);
      } catch {
        throw new HTTPException(401, { message: "Invalid token" });
      }
      if (decoded.uid !== order.userId) {
        throw new HTTPException(403, { message: "Forbidden" });
      }
    } else {
      if (!isValidUUID(sessionId) || sessionId !== order.sessionId) {
        throw new HTTPException(403, { message: "Forbidden" });
      }
    }

    const updated = await confirmCustomerDelivery(orderId);
    return c.json({ success: true, order: updated });
  });

  // Staff: Get my active deliveries
  app.get("/api/staff/my-deliveries", async (c) => {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token || !auth) throw new HTTPException(401, { message: "Unauthorized" });

  try {
    const decoded = await auth.verifyIdToken(token);
    const orders = await getAgentOrders(decoded.uid);
    return c.json({ orders });
  } catch {
    throw new HTTPException(401, { message: "Invalid token" });
  }
  });

  // Admin: Get pending staff applications
  app.get("/api/admin/pending-staff", async (c) => {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token || !auth) throw new HTTPException(401, { message: "Unauthorized" });

  try {
    const decoded = await auth.verifyIdToken(token);
    const profile = await getUserProfile(decoded.uid);
    if (profile.role !== "Admin") throw new HTTPException(403, { message: "Admin only" });

    const pending = await getPendingStaff();
    return c.json({ pending });
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    throw new HTTPException(401, { message: "Invalid token" });
  }
  });

  // Admin: Approve staff
  app.post("/api/admin/approve-staff/:userId", async (c) => {
  const targetUserId = c.req.param("userId");
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token || !auth) throw new HTTPException(401, { message: "Unauthorized" });

  try {
    const decoded = await auth.verifyIdToken(token);
    const profile = await getUserProfile(decoded.uid);
    if (profile.role !== "Admin") throw new HTTPException(403, { message: "Admin only" });

    const updated = await approveStaff(targetUserId);
    return c.json({ profile: updated });
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    throw new HTTPException(401, { message: "Invalid token" });
  }
  });

  // Staff: Initial Application
  app.post("/api/staff/register", async (c) => {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token || !auth) throw new HTTPException(401, { message: "Unauthorized" });

  let body: { role: UserRole };
  try { body = await c.req.json(); } catch { throw new HTTPException(400, { message: "Invalid body" }); }

  try {
    const decoded = await auth.verifyIdToken(token);
    const profile = await registerStaffApplication(decoded.uid, decoded.email || "", body.role);
    return c.json({ profile });
  } catch {
    throw new HTTPException(401, { message: "Registration failed" });
  }
  });
  // --- ROLE MIDDLEWARES ---

  async function checkOperator(c: Context, next: Next) {
    const authHeader = c.req.header("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token || !auth) throw new HTTPException(401, { message: "Unauthorized" });
    try {
      const decoded = await auth.verifyIdToken(token);
      const profile = await getUserProfile(decoded.uid);
      if (profile.role !== "Operator" && profile.role !== "Manager" && profile.role !== "Admin") {
        throw new HTTPException(403, { message: "Operator access required" });
      }
      await next();
    } catch { throw new HTTPException(401, { message: "Invalid token" }); }
  }

  async function checkMarketing(c: Context, next: Next) {
    const authHeader = c.req.header("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token || !auth) throw new HTTPException(401, { message: "Unauthorized" });
    try {
      const decoded = await auth.verifyIdToken(token);
      const profile = await getUserProfile(decoded.uid);
      if (profile.role !== "Marketing" && profile.role !== "Manager" && profile.role !== "Admin") {
        throw new HTTPException(403, { message: "Marketing access required" });
      }
      await next();
    } catch { throw new HTTPException(401, { message: "Invalid token" }); }
  }

  // --- OPERATOR ROUTES ---
  app.get("/api/operator/queue", checkOperator, async (c) => {
    const all = await getOrders();
    const queue = all.filter(o => o.status === "Pending" || o.status === "Processing");
    return c.json({ orders: queue });
  });

  // --- MARKETING ROUTES ---
  app.get("/api/marketing/analytics", checkMarketing, async (c) => {
    const orders = await getOrders();
    const stats = buildFinancialSummary(orders);
    return c.json(stats);
  });

  app.get("/api/marketing/vip-users", checkMarketing, async (c) => {
    // In a real app, this would query the DB. Here we simulate with some data
    return c.json({ message: "VIP data restricted to production DB" });
  });

  // Admin endpoints
  async function checkAdmin(c: Context, next: Next) {
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
    const profile = await getUserProfile(decoded.uid);
    
    if (profile.role !== "Admin") {
      throw new HTTPException(403, { message: "Forbidden: Admin access required" });
    }
    
    await next();
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    throw new HTTPException(401, { message: "Invalid token" });
  }
  }

  app.get("/api/admin/orders", checkAdmin, async (c) => {
  try {
    const orders = await getOrders();
    return c.json({ orders, count: orders.length });
  } catch (err) {
    console.error("[Admin API] Failed to fetch orders:", err);
    throw new HTTPException(500, { message: "Failed to fetch orders" });
  }
  });

  app.get("/api/admin/financials", checkAdmin, async (c) => {
    try {
      const orders = await getOrders();
      return c.json(buildFinancialSummary(orders));
    } catch (err) {
      console.error("[Admin API] Failed to build financial summary:", err);
      throw new HTTPException(500, { message: "Failed to load financial summary" });
    }
  });

  app.get("/api/admin/staff", checkAdmin, async (c) => {
    try {
      const staff = await getStaffMembers();
      return c.json({ staff, count: staff.length });
    } catch (err) {
      console.error("[Admin API] Failed to fetch staff:", err);
      throw new HTTPException(500, { message: "Failed to fetch staff directory" });
    }
  });

  app.patch("/api/admin/staff/:userId", checkAdmin, async (c) => {
    const targetUserId = c.req.param("userId");
    const admin = await getAuthenticatedUser(c);

    let body: Partial<{
      role: UserRole;
      isApproved: boolean;
      employmentStatus: "Active" | "PendingApproval" | "Suspended";
      department: string;
      hrNotes: string;
    }>;

    try {
      body = await c.req.json();
    } catch {
      throw new HTTPException(400, { message: "Invalid JSON body" });
    }

    if (targetUserId === admin.uid && (body.role && body.role !== "Admin")) {
      throw new HTTPException(400, { message: "Admins cannot remove their own admin role from this panel." });
    }

    if (targetUserId === admin.uid && body.employmentStatus === "Suspended") {
      throw new HTTPException(400, { message: "Admins cannot suspend themselves." });
    }

    const updated = await updateStaffProfile(targetUserId, body);
    if (!updated) throw new HTTPException(404, { message: "Employee not found" });

    return c.json({ success: true, profile: updated });
  });

  app.put("/api/admin/orders/:orderId/status", checkAdmin, async (c) => {
  const orderId = Number(c.req.param("orderId"));
  if (!Number.isFinite(orderId)) {
    throw new HTTPException(400, { message: "Invalid order ID" });
  }

  let body: { status: OrderStatus };
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  }

  const validStatuses = ["Pending", "Processing", "Shipped", "Cancelled"];
  if (!validStatuses.includes(body.status)) {
    throw new HTTPException(400, { message: "Admin can only set status to Pending, Processing, Shipped, or Cancelled. 'Out for Delivery' and 'Delivered' are handled by delivery agents." });
  }

  try {
    const order = await updateOrderStatus(orderId, body.status);
    if (!order) throw new HTTPException(404, { message: "Order not found" });
    return c.json({ success: true, order });
  } catch (err) {
    console.error("[Admin API] Failed to update order:", err);
    throw new HTTPException(500, { message: "Failed to update order" });
  }
  });

  app.post("/api/admin/orders/:orderId/finalize-delivery", checkAdmin, async (c) => {
    const orderId = Number(c.req.param("orderId"));
    if (!Number.isFinite(orderId)) {
      throw new HTTPException(400, { message: "Invalid order ID" });
    }

    const order = await getOrderById(orderId);
    if (!order) throw new HTTPException(404, { message: "Order not found" });
    if (!order.agentDeliveryConfirmed || !order.customerDeliveryConfirmed) {
      throw new HTTPException(400, { message: "Both customer and delivery agent must confirm before admin finalization." });
    }
    if (order.amountDue > 0 || order.paymentStatus !== "Paid") {
      throw new HTTPException(400, { message: "Orders can only be finalized after payment has been completed in full." });
    }

    const updated = await confirmAdminDelivery(orderId);
    return c.json({ success: true, order: updated });
  });

  app.get("/api/orders/session/:sessionId", async (c) => {  const sessionId = c.req.param("sessionId");
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

app.get("/api/orders/:orderId", async (c) => {
  const orderId = Number(c.req.param("orderId"));
  if (!Number.isFinite(orderId)) {
    throw new HTTPException(400, { message: "Invalid order ID" });
  }
  const order = await getOrderById(orderId);
  if (!order) throw new HTTPException(404, { message: "Order not found" });

  // Authorization: require Bearer token matching order's userId, or sessionId query matching order's sessionId
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const sessionId = c.req.query("sessionId") || "";

  if (order.userId) {
    if (!auth) {
      throw new HTTPException(503, { message: "Auth service unavailable" });
    }
    if (!token) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }
    let decoded;
    try {
      decoded = await auth.verifyIdToken(token);
    } catch {
      throw new HTTPException(401, { message: "Invalid token" });
    }
    if (decoded.uid !== order.userId) {
      throw new HTTPException(403, { message: "Forbidden" });
    }
  } else if (order.sessionId) {
    if (!isValidUUID(sessionId) || sessionId !== order.sessionId) {
      throw new HTTPException(403, { message: "Forbidden" });
    }
  }

  return c.json({ order });
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
