import "dotenv/config";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import type { Context, Next } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { readFileSync } from "fs";
import {
  adjustInventoryHandler,
  archiveProductHandler,
  createProductHandler,
  duplicateProductHandler,
  getProducts as getAdminProductsHandler,
  updateProductHandler,
} from "./controllers/product.controller.js";
import { adminAuthMiddleware } from "./middleware/auth.js";
import { products as seededProducts } from "./data/products.js";
import { findTierBySize, tierPrice } from "./data/sizeTiers.js";
import type { CartItem, Order, OrderStatus, PaymentMethod, ShippingDetails, UserRole, UserTier, RefundEntry } from "./types.js";
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
  cancelOrder,
  getOrderByMpesaCheckoutRequestId,
  getOrderByBalanceMpesaCheckoutRequestId,
  requestPaymentPrompt,
  recordOrderPayment,
  updateOrderPaymentMeta,
  appendOrderAudit,
  markInventoryReserved,
  markInventoryRestored,
  markLoyaltyAwarded,
  markLoyaltyReversed,
  patchOrder,
  recordRefund,
} from "./db/orders.js";
import { adjustUserAccountBalance, getUserProfile, updateUserSpent, getPendingStaff, approveStaff, registerStaffApplication, getStaffMembers, setSpecialTier, updateStaffProfile } from "./db/users.js";
import { addLedgerEntry } from "./db/ledger.js";
import { auth } from "./db/firebase.js";
import { addSystemLog, getSystemLogs } from "./db/logs.js";
import { initiateMpesaStkPush, normalizeMpesaPhone } from "./mpesa.js";
import { canUseLedger, evaluatePaymentPolicy, getTierPolicy, getTierProgress } from "./lib/membership.js";
import { adjustInventory, getProductById as getManagedProductById, getStorefrontProducts } from "./db/products.js";
import { castVote, getProductVotes, aggregateVotes, VOTE_ATTRIBUTES, type VoteAttribute } from "./db/votes.js";

const app = new Hono();

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  console.error("[Server Error Detail]", {
    message: err.message,
    stack: err.stack,
    cause: err.cause,
  });
  return c.json({ message: "Internal server error", detail: err.message }, 500);
});

app.use("*", async (c, next) => {
  c.header("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  await next();
});

app.use(
  cors({
    origin: (origin) => {
      const allowed = [
        "http://localhost:5173",
        "http://localhost:4173",
        "http://localhost:3000",
      ];
      if (!origin) return "*";
      if (allowed.includes(origin)) return origin;
      if (origin.endsWith(".onrender.com")) return origin;
      return null;
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Health check
app.get("/api/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// SEO: robots.txt and sitemap.xml served explicitly so crawlers always find them.
// Falls back to public/ when dist/ has not been built (dev server mode).
function readStaticFile(filename: string): string | null {
  for (const root of ["./dist", "./public"]) {
    try {
      return readFileSync(`${root}/${filename}`, "utf-8");
    } catch {
      // try next root
    }
  }
  return null;
}

app.get("/robots.txt", (c) => {
  const content = readStaticFile("robots.txt");
  if (content == null) throw new HTTPException(404, { message: "Not found" });
  c.header("Content-Type", "text/plain");
  return c.body(content);
});

app.get("/sitemap.xml", (c) => {
  const content = readStaticFile("sitemap.xml");
  if (content == null) throw new HTTPException(404, { message: "Not found" });
  c.header("Content-Type", "application/xml");
  return c.body(content);
});

// Products
app.get("/api/products", async (c) => {
  const products = await getStorefrontProducts();
  return c.json({ products, count: products.length });
});

app.get("/api/products/admin", adminAuthMiddleware, getAdminProductsHandler);
app.post("/api/products", adminAuthMiddleware, createProductHandler);
app.put("/api/products/:id", adminAuthMiddleware, updateProductHandler);
app.patch("/api/products/:id/inventory", adminAuthMiddleware, adjustInventoryHandler);
app.post("/api/products/:id/duplicate", adminAuthMiddleware, duplicateProductHandler);
app.delete("/api/products/:id", adminAuthMiddleware, archiveProductHandler);

app.get("/api/products/:id", async (c) => {
  const id = c.req.param("id");
  const product = await getManagedProductById(id);
  if (!product) throw new HTTPException(404, { message: "Product not found" });
  return c.json({ product });
});

function parsePrice(price: unknown): number {
  if (typeof price !== "string") return 0;
  return Number(price.replace(/[^0-9.]/g, "")) || 0;
}

function getCartTotals(items: CartItem[] = []) {
  if (!Array.isArray(items)) {
    return { count: 0, total: 0 };
  }
  const count = items.reduce((sum, i) => sum + (Number(i?.quantity) || 0), 0);
  const total = items.reduce((sum, i) => {
    const price = typeof i?.price === "string" ? parsePrice(i.price) : 0;
    return sum + price * (Number(i?.quantity) || 0);
  }, 0);
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

function isAuthConfigurationMismatch(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("incorrect \"aud\"") ||
    message.includes("incorrect \"iss\"") ||
    message.includes("Firebase ID token has invalid signature") ||
    message.includes("Firebase project")
  );
}

async function verifyAuthToken(token: string) {
  if (!token) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  if (!auth) {
    throw new HTTPException(503, { message: "Auth service unavailable" });
  }

  try {
    return await auth.verifyIdToken(token);
  } catch (err) {
    console.error("[Auth] Token verification failed:", err instanceof Error ? err.message : "unknown error");
    if (isAuthConfigurationMismatch(err)) {
      throw new HTTPException(503, {
        message: "Authentication configuration mismatch between client and server. Rebuild the frontend with the correct Firebase web config and redeploy.",
      });
    }
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

function isAccountBalanceTier(tier: UserTier): boolean {
  return getTierPolicy(tier).canUseLedger;
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
    (order.items || [])
      .reduce((sum, item) => {
        const product = seededProducts.find((p) => p.id === item.productId);
        const unitPrice = parsePrice(item.price);
        const qty = Number(item.quantity) || 0;
        return sum + unitPrice * estimateCogsRatio(product?.collection) * qty;
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

function getCancellationMessage(order: Order) {
  return order.cancellationMessage || "Your order was cancelled. Any pending charges were voided and further payment is disabled.";
}

async function awardLoyaltyIfEligible(order: Order) {
  if (!order.userId) return order;
  if (order.paymentStatus !== "Paid") return order;
  if (order.loyaltyAwardedAt) return order;
  await updateUserSpent(order.userId, order.total);
  return (await markLoyaltyAwarded(order.orderId)) || order;
}

async function reverseLoyaltyIfNeeded(order: Order) {
  if (!order.userId || !order.loyaltyAwardedAt || order.loyaltyReversedAt) return order;
  await updateUserSpent(order.userId, -order.total);
  return (await markLoyaltyReversed(order.orderId)) || order;
}

async function reverseOrderFinancials(order: Order, actorId = "admin", actorEmail?: string) {
  if (order.refundStatus === "Reversed") {
    return order;
  }

  const refundStatus: RefundEntry["status"] = "succeeded";
  let refundChannel: RefundEntry["channel"] = "cod_void";
  let refundAmount = 0;
  let refundReason = "Order cancelled before fulfillment.";

  if (order.paymentMethod === "PayOnDelivery" && order.userId && isAccountBalanceTier((await getUserProfile(order.userId)).tier)) {
    refundAmount = Math.max(0, Number((order.total - order.amountPaid).toFixed(2)));
    if (refundAmount > 0) {
      const profile = await adjustUserAccountBalance(order.userId, refundAmount);
      await addLedgerEntry({
        id: crypto.randomUUID(),
        userId: order.userId,
        orderId: order.orderId,
        type: "reversal",
        direction: "credit",
        amount: refundAmount,
        balanceAfter: profile.accountBalance,
        description: `Cancellation reversal for order ${order.orderId}`,
        createdAt: new Date().toISOString(),
        actorId,
        actorEmail,
      });
    }
    refundChannel = "ledger_reversal";
    refundReason = "Ledger charge reversed on cancellation.";
  } else if ((order.paymentMethod === "Card" || order.paymentMethod === "Mpesa") && order.amountPaid > 0) {
    refundAmount = order.amountPaid;
    refundChannel = "gateway_refund";
    refundReason = `${order.paymentMethod} payment marked for refund reversal.`;
  } else {
    refundAmount = 0;
    refundChannel = "cod_void";
    refundReason = "Outstanding pay-after-delivery balance voided.";
  }

  const refundEntry: RefundEntry = {
    refundId: crypto.randomUUID(),
    amount: Number(refundAmount.toFixed(2)),
    channel: refundChannel,
    status: refundStatus,
    reason: refundReason,
    createdAt: new Date().toISOString(),
    createdBy: actorId,
  };

  const patched = await patchOrder(order.orderId, {
    amountDue: 0,
    paymentStatus:
      refundChannel === "cod_void"
        ? order.amountPaid > 0
          ? "PartiallyRefunded"
          : "Unpaid"
        : refundAmount >= order.amountPaid
          ? "Refunded"
          : "PartiallyRefunded",
  });

  if (patched) {
    await recordRefund(
      order.orderId,
      refundEntry,
      refundAmount > 0 ? "Reversed" : "None"
    );
    await reverseLoyaltyIfNeeded(patched);
  }

  return (await getOrderById(order.orderId)) || order;
}

async function restoreInventoryForOrder(order: Order, actorId = "system", actorEmail?: string) {
  if (order.inventoryRestoredAt) {
    return order;
  }

  for (const item of order.items) {
    await adjustInventory(
      item.productId,
      item.quantity,
      "order_cancelled",
      actorId,
      actorEmail,
      order.orderId,
      "Inventory restored after order cancellation."
    );
  }

  await markInventoryRestored(order.orderId);
  await appendOrderAudit(order.orderId, {
    type: "inventory_restored",
    message: "Inventory restored after cancellation.",
  });
  return (await getOrderById(order.orderId)) || order;
}

async function settleMockMpesaPayment(order: Order, phoneNumber: string, receiptNumber: string) {
  const amountToSettle = Number(order.amountDue.toFixed(2));
  let updated = await recordOrderPayment(order.orderId, amountToSettle, "mpesa_stk");
  if (updated) {
    await updateOrderPaymentMeta(order.orderId, {
      paymentPhone: phoneNumber,
      paymentReference: receiptNumber,
      mpesaReceiptNumber: receiptNumber,
      paymentLastError: undefined,
      mpesaMerchantRequestId: updated.mpesaMerchantRequestId,
      mpesaCheckoutRequestId: updated.mpesaCheckoutRequestId,
    });
    updated = await awardLoyaltyIfEligible(updated);
  }

  return updated;
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
  const operatingNetWorth = Number((realizedRevenue - totalEstimatedCogs).toFixed(2));
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
        const paymentDate = typeof payment.timestamp === "number"
          ? new Date(payment.timestamp).toISOString()
          : new Date().toISOString();
        const paymentWeek = resolveWeek(paymentDate);
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
  const weeklyTrend = weeklyWindow.map(({ key, label }) => {
    const week = weeklyMap.get(key);
    const currentProfit = week ? Number((week.realizedRevenue - week.recognizedExpense).toFixed(2)) : 0;
    cumulativeNetWorth += currentProfit;
    
    const prevProfit = previousEstimatedProfit || 0;
    const trendColor = currentProfit > prevProfit ? "green" : "red";
    const direction = previousEstimatedProfit == null ? "flat" : currentProfit >= previousEstimatedProfit ? "up" : "down";
    
    const result = {
      label,
      bookedRevenue: week ? Number(week.bookedRevenue.toFixed(2)) : 0,
      realizedRevenue: week ? Number(week.realizedRevenue.toFixed(2)) : 0,
      recognizedExpense: week ? Number(week.recognizedExpense.toFixed(2)) : 0,
      estimatedProfit: currentProfit,
      profit: currentProfit,
      previousWeekProfit: prevProfit,
      netWorth: Number(cumulativeNetWorth.toFixed(2)),
      direction,
      trendColor,
    };
    
    previousEstimatedProfit = currentProfit;
    return result;
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

// ── Community Votes ───────────────────────────────────────────────────────────

app.get("/api/products/:id/votes", async (c) => {
  const productId = c.req.param("id");

  const votes = await getProductVotes(productId);
  const attributes = aggregateVotes(votes);

  // Count unique voters
  const voterSet = new Set(votes.map((v) => v.voterId));
  const totalVoters = voterSet.size;

  // Optionally resolve caller's own votes (soft auth — no error if missing)
  const myVotes: Partial<Record<VoteAttribute, "yes" | "no">> = {};

  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const sessionId = c.req.query("sessionId") || "";

  let voterId: string | null = null;

  if (token && auth) {
    try {
      const decoded = await auth.verifyIdToken(token);
      voterId = decoded.uid;
    } catch {
      // soft auth — ignore invalid token
    }
  } else if (sessionId) {
    voterId = sessionId;
  }

  if (voterId) {
    const myVoteList = votes.filter((v) => v.voterId === voterId);
    for (const v of myVoteList) {
      myVotes[v.attribute] = v.vote;
    }
  }

  return c.json({ attributes, totalVoters, myVotes });
});

app.post("/api/products/:id/votes", async (c) => {
  const productId = c.req.param("id");

  // Require auth OR sessionId
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const sessionId = c.req.query("sessionId") || "";

  let voterId: string | null = null;

  if (token && auth) {
    try {
      const decoded = await auth.verifyIdToken(token);
      voterId = decoded.uid;
    } catch {
      throw new HTTPException(401, { message: "Invalid token" });
    }
  } else if (sessionId) {
    voterId = sessionId;
  } else {
    throw new HTTPException(401, { message: "Authentication or sessionId required to vote" });
  }

  let body: { attribute: VoteAttribute; vote: "yes" | "no" };
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  }

  if (!VOTE_ATTRIBUTES.includes(body.attribute)) {
    throw new HTTPException(400, { message: "Invalid vote attribute" });
  }
  if (body.vote !== "yes" && body.vote !== "no") {
    throw new HTTPException(400, { message: "Vote must be 'yes' or 'no'" });
  }

  await castVote({
    productId,
    voterId,
    attribute: body.attribute,
    vote: body.vote,
    updatedAt: new Date().toISOString(),
  });

  // Return updated aggregate
  const votes = await getProductVotes(productId);
  const attributes = aggregateVotes(votes);
  const voterSet = new Set(votes.map((v) => v.voterId));
  const totalVoters = voterSet.size;

  const myVotes: Partial<Record<VoteAttribute, "yes" | "no">> = {};
  const myVoteList = votes.filter((v) => v.voterId === voterId);
  for (const v of myVoteList) {
    myVotes[v.attribute] = v.vote;
  }

  return c.json({ attributes, totalVoters, myVotes });
});

// ─────────────────────────────────────────────────────────────────────────────

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
    size?: string;
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
    // One line per product: a re-add with a different size switches the line
    // to the latest selection (cart is keyed by productId end-to-end).
    items = current.map((i) =>
      i.productId === body.productId ? { ...i, ...body, quantity: i.quantity + qty } : i
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
  let body: {
    sessionId: string;
    items: CartItem[];
    shipping?: ShippingDetails;
    paymentMethod?: PaymentMethod;
    paymentPhone?: string;
    upfrontAmount?: number;
  };
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  }
  const { sessionId, items, shipping, paymentMethod = "Card", paymentPhone, upfrontAmount } = body;

  if (!sessionId || !isValidUUID(sessionId) || !Array.isArray(items) || items.length === 0) {
    throw new HTTPException(400, { message: "Invalid checkout payload" });
  }
  if (paymentMethod !== "Card" && paymentMethod !== "PayOnDelivery" && paymentMethod !== "Mpesa") {
    throw new HTTPException(400, { message: "Invalid payment method" });
  }

  let total = 0;
  const validatedItems: CartItem[] = [];

  for (const item of items) {
    const product = await getManagedProductById(item.productId);
    if (!product) {
      throw new HTTPException(400, { message: `Unknown product: ${item.productId}` });
    }
    const qty = Math.max(1, Math.floor(item.quantity || 1));
    if (product.status !== "published" || product.visibility !== "public") {
      throw new HTTPException(400, { message: `${product.name} is not currently available for checkout.` });
    }
    if (product.stockQuantity < qty) {
      throw new HTTPException(409, { message: `${product.name} only has ${product.stockQuantity} unit(s) left in stock.` });
    }
    // Server-side pricing: catalog base price scaled by the bottle format.
    // Unknown or missing sizes price as Signature (multiplier 1).
    const tier = findTierBySize(item.size);
    const price = tierPrice(Number(product.price), tier);
    const primaryImage = product.images.find((image) => image.isPrimary) || product.images[0];
    total += price * qty;
    validatedItems.push({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      price: `KES ${Math.round(price).toLocaleString()}`,
      image: primaryImage?.url || "",
      quantity: qty,
      size: tier.size,
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
  const effectiveTier: UserTier = customerProfile?.tier ?? "Junior";
  const policyEvaluation = evaluatePaymentPolicy({
    isGuest: !userId,
    tier: effectiveTier,
    paymentMethod,
    orderTotal: Number(total.toFixed(2)),
    accountBalance: customerProfile?.accountBalance ?? 0,
    upfrontAmount,
  });

  if (!policyEvaluation.allowed) {
    throw new HTTPException(403, { message: policyEvaluation.reason || "Payment method is not allowed for this membership tier." });
  }

  if (paymentMethod === "PayOnDelivery" && (!userId || !customerProfile)) {
    throw new HTTPException(403, { message: "Cash-on-delivery requires a signed-in membership account." });
  }

  if (paymentMethod === "PayOnDelivery") {
    const policy = policyEvaluation.policy;
    payOnDeliveryLimit = policy.maxOutstandingBalance == null ? undefined : policy.maxOutstandingBalance;
    initialAmountPaid = Number(policyEvaluation.upfrontAmount.toFixed(2));
    paymentPromptCount = 0;
    paymentPromptRequestedAt = undefined;

    if (policy.canUseLedger) {
      accountBalanceDelta = -Number(policyEvaluation.ledgerCharge.toFixed(2));
      if (policyEvaluation.ledgerCharge <= 0) {
        paymentReference = "LEDGER_PREPAID";
      } else if (initialAmountPaid > 0) {
        paymentReference = "LEDGER_PARTIAL";
      } else {
        paymentReference = "ACCOUNT_CREDIT";
      }
    } else {
      paymentReference = "PAY_AFTER_DELIVERY";
    }
  } else if (paymentMethod === "Mpesa") {
    initialAmountPaid = 0;
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

  // Reserve stock item by item; if a race depleted stock since validation,
  // roll back partial reservations and void the order instead of leaving it half-reserved.
  const reservedItems: CartItem[] = [];
  try {
    for (const item of validatedItems) {
      await adjustInventory(
        item.productId,
        -item.quantity,
        "order_placed",
        userId || "guest",
        userEmail,
        order.orderId,
        "Inventory reserved at checkout."
      );
      reservedItems.push(item);
    }
  } catch (err) {
    for (const reserved of reservedItems) {
      await adjustInventory(
        reserved.productId,
        reserved.quantity,
        "order_cancelled",
        "system",
        undefined,
        order.orderId,
        "Reservation rolled back after stock conflict at checkout."
      ).catch(() => undefined);
    }
    await cancelOrder(order.orderId, "Order voided: stock became unavailable during checkout.");
    addSystemLog("warning", "Checkout", `Order ${order.orderId} voided due to stock conflict during reservation.`);
    throw new HTTPException(409, {
      message: err instanceof Error ? err.message : "One of the items just sold out. Please review your cart and try again.",
    });
  }
  await markInventoryReserved(order.orderId);
  await appendOrderAudit(order.orderId, {
    type: "inventory_reserved",
    message: "Inventory reserved at checkout.",
  });

  if (paymentMethod === "Mpesa" && normalizedPaymentPhone) {
    // 50/50 split: STK push charges the deposit only (50%); balance due on delivery.
    const depositAmount = Math.round(order.total * 0.5);
    const balanceDue = Math.round(order.total - depositAmount);

    try {
      const stk = await initiateMpesaStkPush({
        amount: depositAmount,
        phoneNumber: normalizedPaymentPhone,
        accountReference: `ORDER-${order.orderId}-DEP`,
        transactionDesc: `Noir deposit for order ${order.orderId}`,
      });

      await updateOrderPaymentMeta(order.orderId, {
        paymentPhone: normalizedPaymentPhone,
        paymentRequestedAt: new Date().toISOString(),
        paymentLastError: undefined,
        mpesaMerchantRequestId: stk.merchantRequestId,
        mpesaCheckoutRequestId: stk.checkoutRequestId,
      });

      // Persist deposit / balance split on the order
      await patchOrder(order.orderId, { depositAmount, balanceDue });

      let settledOrder = (await getOrderById(order.orderId)) || order;
      if (stk.mock && depositAmount > 0) {
        // In sandbox: auto-settle the deposit amount only (not the full total)
        const depositSettled = await recordOrderPayment(order.orderId, depositAmount, "mpesa_stk");
        if (depositSettled) {
          await updateOrderPaymentMeta(order.orderId, {
            paymentPhone: normalizedPaymentPhone,
            paymentReference: stk.receiptNumber || `MOCK-DEP-${order.orderId}`,
            mpesaReceiptNumber: stk.receiptNumber || `MOCK-DEP-${order.orderId}`,
            paymentLastError: undefined,
          });
          // Loyalty not awarded yet — full payment happens on delivery
          settledOrder = (await getOrderById(order.orderId)) || depositSettled;
        }
      }
      await deleteCart(sessionId);

      return c.json({
        success: true,
        orderId: order.orderId,
        total: order.total,
        depositAmount,
        balanceDue,
        order: settledOrder,
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

  if (paymentMethod === "PayOnDelivery" && userId && accountBalanceDelta !== 0) {
    const updatedProfile = await adjustUserAccountBalance(userId, accountBalanceDelta);
    await addLedgerEntry({
      id: crypto.randomUUID(),
      userId,
      orderId: order.orderId,
      type: "charge",
      direction: "debit",
      amount: Math.abs(accountBalanceDelta),
      balanceAfter: updatedProfile.accountBalance,
      description: `Ledger-backed checkout for order ${order.orderId}`,
      createdAt: new Date().toISOString(),
      actorId: userId,
      actorEmail: userEmail,
      metadata: { paymentReference: paymentReference || "ACCOUNT_CREDIT" },
    });
  }

  await deleteCart(sessionId);

  const finalizedOrder = await awardLoyaltyIfEligible((await getOrderById(order.orderId)) || order);
  return c.json({ success: true, orderId: order.orderId, total: order.total, order: finalizedOrder });
  });

// ── Fragrance Swap Requests ───────────────────────────────────────────────────

app.post("/api/swaps/request", async (c) => {
  let body: { targetFragrance: string; note?: string };
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Invalid request body" });
  }
  const { targetFragrance, note } = body;
  if (!targetFragrance?.trim()) {
    throw new HTTPException(400, { message: "targetFragrance is required" });
  }

  // Optionally resolve authenticated user
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  let userId: string | undefined;
  let userEmail: string | undefined;

  if (token && auth) {
    try {
      const decoded = await auth.verifyIdToken(token);
      userId = decoded.uid;
      userEmail = decoded.email || undefined;
    } catch {
      // soft — guests can still request swaps
    }
  }

  const swapId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  // Log swap request to system logs for admin visibility
  addSystemLog("info", "Swaps", `Swap request ${swapId}: ${userId ?? "guest"} → ${targetFragrance}${note ? ` (${note})` : ""}`);

  // Persist swap count on user profile (first swap free, subsequent +200)
  let swapFee = 0;
  if (userId) {
    const profile = await getUserProfile(userId, userEmail);
    const currentSwapCount = profile.swapCount ?? 0;
    swapFee = currentSwapCount >= 1 ? 200 : 0;

    // Increment swap count on user profile via updateStaffProfile (patch)
    await updateStaffProfile(userId, { swapCount: currentSwapCount + 1 });
  }

  return c.json({
    success: true,
    swapId,
    createdAt,
    targetFragrance,
    swapFee,
    message: swapFee === 0
      ? "Your free swap request has been received. Our team will contact you within 24 hours."
      : `Your swap request (KES ${swapFee} fee) has been received. Our team will contact you within 24 hours.`,
  });
});

app.get("/api/user/profile", async (c) => {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  try {
    const decoded = await verifyAuthToken(token);
    const profile = await getUserProfile(decoded.uid, decoded.email);
    const tierProgress = getTierProgress(profile.totalSpent ?? 0, profile.completedOrderCount ?? 0);
    return c.json({ profile, tierProgress });
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    console.error("[API] Failed to load user profile:", err);
    throw new HTTPException(500, { message: "Unable to load your profile right now." });
  }
  });

  app.post("/api/user/account/deposit", async (c) => {
    const decoded = await getAuthenticatedUser(c);
    const profile = await getUserProfile(decoded.uid, decoded.email);

    let body: { amount: number };
    try {
      body = await c.req.json();
    } catch {
      throw new HTTPException(400, { message: "Invalid deposit body" });
    }

    if (!Number.isFinite(body.amount) || body.amount <= 0) {
      throw new HTTPException(400, { message: "Deposit amount must be greater than zero." });
    }

    if (!canUseLedger(profile)) {
      throw new HTTPException(403, { message: `${profile.tier} members cannot use the running balance account.` });
    }
    if (getTierPolicy(profile.tier).rank < getTierPolicy("Gold").rank) {
      throw new HTTPException(403, { message: "Deposits unlock at Gold tier. Silver can settle balances during checkout repayment." });
    }

    const updatedProfile = await adjustUserAccountBalance(decoded.uid, Number(body.amount.toFixed(2)));
    await addLedgerEntry({
      id: crypto.randomUUID(),
      userId: decoded.uid,
      type: "deposit",
      direction: "credit",
      amount: Number(body.amount.toFixed(2)),
      balanceAfter: updatedProfile.accountBalance,
      description: "Customer deposit to running balance",
      createdAt: new Date().toISOString(),
      actorId: decoded.uid,
      actorEmail: decoded.email,
    });
    return c.json({ success: true, profile: updatedProfile });
  });

  // Fulfillment: advance order through the operator pipeline.
  // Operators move orders Pending -> Processing -> Shipped only;
  // "Out for Delivery" and "Delivered" are owned by delivery agents.
  app.post("/api/orders/:orderId/advance", checkOperator, async (c) => {
  const orderId = Number(c.req.param("orderId"));
  if (!Number.isFinite(orderId)) {
    throw new HTTPException(400, { message: "Invalid order ID" });
  }
  const order = await getOrderById(orderId);
  if (!order) throw new HTTPException(404, { message: "Order not found" });

  const operatorStatuses: OrderStatus[] = ["Pending", "Processing", "Shipped"];
  const currentIndex = operatorStatuses.indexOf(order.status);

  if (currentIndex === -1) {
    throw new HTTPException(400, { message: `Order is "${order.status}" and can no longer be advanced from the fulfillment queue.` });
  }
  if (currentIndex === operatorStatuses.length - 1) {
    return c.json({ order, message: "Order already shipped. Delivery agents handle the remaining stages." });
  }

  const nextStatus = operatorStatuses[currentIndex + 1];
  const updatedOrder = await updateOrderStatus(orderId, nextStatus);

  return c.json({ order: updatedOrder });
  });

  app.post("/api/orders/:orderId/comment", async (c) => {
    const orderId = Number(c.req.param("orderId"));
    if (!Number.isFinite(orderId)) throw new HTTPException(400, { message: "Invalid order ID" });
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
    if (!Number.isFinite(orderId)) throw new HTTPException(400, { message: "Invalid order ID" });
    const order = await getOrderById(orderId);
    if (!order) throw new HTTPException(404, { message: "Order not found" });
    if (order.status === "Cancelled") {
      throw new HTTPException(400, { message: getCancellationMessage(order) });
    }
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

const handleCustomerOrderCancellation = async (c: Context) => {
  const orderId = Number(c.req.param("orderId"));
  if (!Number.isFinite(orderId)) {
    throw new HTTPException(400, { message: "Invalid order ID" });
  }

  const order = await getOrderById(orderId);
  if (!order) throw new HTTPException(404, { message: "Order not found" });
  await ensureOrderAccess(c, order);

  if (order.status === "Shipped" || order.status === "Out for Delivery" || order.status === "Delivered") {
    throw new HTTPException(400, { message: "This order can no longer be cancelled by the customer." });
  }
  if (order.status === "Cancelled") {
    return c.json({ success: true, order });
  }

  const cancellationMessage = "Order cancelled by customer before dispatch.";
  const cancelledOrder = await cancelOrder(orderId, cancellationMessage);
  await reverseOrderFinancials(cancelledOrder ?? order, order.userId || "guest", order.userEmail);
  await restoreInventoryForOrder(order, order.userId || "guest", order.userEmail);
  const updated = (await getOrderById(orderId)) || order;
  addSystemLog("info", "OrderCancellation", `Customer cancelled order ${orderId}.`);
  return c.json({ success: true, order: updated });
};

app.post("/api/orders/:orderId/cancel", handleCustomerOrderCancellation);
app.post("/api/orders/:orderId/customer-cancel", handleCustomerOrderCancellation);

  app.post("/api/orders/:orderId/pay", async (c) => {
    const orderId = Number(c.req.param("orderId"));
    if (!Number.isFinite(orderId)) throw new HTTPException(400, { message: "Invalid order ID" });
    const order = await getOrderById(orderId);
    if (!order) throw new HTTPException(404, { message: "Order not found" });
    if (order.status === "Cancelled") {
      throw new HTTPException(400, { message: getCancellationMessage(order) });
    }
    if (order.paymentMethod !== "PayOnDelivery") {
      throw new HTTPException(400, { message: order.paymentMethod === "Mpesa" ? "Use M-Pesa STK push for this order." : "This order was already paid by card." });
    }

    let body: { amount: number };
    try {
      body = await c.req.json();
    } catch {
      throw new HTTPException(400, { message: "Invalid payment body" });
    }

    const actor = await ensureOrderAccess(c, order);
    if (!Number.isFinite(body.amount) || body.amount <= 0) {
      throw new HTTPException(400, { message: "Payment amount must be greater than zero." });
    }
    if (body.amount > order.amountDue) {
      throw new HTTPException(400, { message: "Payment amount exceeds the remaining balance." });
    }
    const customerTierProfile = order.userId ? await getUserProfile(order.userId) : undefined;
    const allowPartialRepayment = !!customerTierProfile && canUseLedger(customerTierProfile);
    if (!allowPartialRepayment && Number(body.amount.toFixed(2)) !== Number(order.amountDue.toFixed(2))) {
      throw new HTTPException(400, { message: "This order requires settling the full remaining balance in one payment." });
    }

    const settledAmount = Number((allowPartialRepayment ? body.amount : order.amountDue).toFixed(2));
    let updated = await recordOrderPayment(orderId, settledAmount);
    if (updated) {
      if (order.userId) {
        if (customerTierProfile && canUseLedger(customerTierProfile)) {
          const balance = await adjustUserAccountBalance(order.userId, settledAmount);
          await addLedgerEntry({
            id: crypto.randomUUID(),
            userId: order.userId,
            orderId: order.orderId,
            type: "deposit",
            direction: "credit",
            amount: settledAmount,
            balanceAfter: balance.accountBalance,
            description: `Ledger repayment for order ${order.orderId}`,
            createdAt: new Date().toISOString(),
            actorId: actor?.uid || order.userId,
            actorEmail: actor?.email || order.userEmail,
          });
        }
      }
      updated = await awardLoyaltyIfEligible(updated);
    }
    return c.json({ success: true, order: updated });
  });

  app.post("/api/orders/:orderId/mpesa-stk", async (c) => {
    const orderId = Number(c.req.param("orderId"));
    if (!Number.isFinite(orderId)) throw new HTTPException(400, { message: "Invalid order ID" });
    const order = await getOrderById(orderId);
    if (!order) throw new HTTPException(404, { message: "Order not found" });
    if (order.status === "Cancelled") {
      throw new HTTPException(400, { message: getCancellationMessage(order) });
    }
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

      let responseOrder = updated;
      if (stk.mock && order.amountDue > 0) {
        responseOrder = (await settleMockMpesaPayment(order, normalizedPhone, stk.receiptNumber || `MOCK-${order.orderId}`)) || updated;
      }

      return c.json({
        success: true,
        order: responseOrder,
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

  // When MPESA_CALLBACK_SECRET is set, Daraja must be configured to call
  // /api/payments/mpesa/callback/<secret>; the bare route is then rejected.
  const mpesaCallbackHandler = async (c: Context) => {
    const configuredSecret = process.env.MPESA_CALLBACK_SECRET || "";
    if (configuredSecret) {
      const providedSecret = c.req.param("secret") || "";
      if (providedSecret !== configuredSecret) {
        addSystemLog("warning", "MpesaCallback", "Rejected callback with missing or invalid secret.");
        throw new HTTPException(403, { message: "Forbidden" });
      }
    }
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

    let order = await getOrderByMpesaCheckoutRequestId(callback.CheckoutRequestID);
    const isBalancePayment = !order;
    if (isBalancePayment) {
      order = await getOrderByBalanceMpesaCheckoutRequestId(callback.CheckoutRequestID);
    }
    if (!order) {
      return c.json({ success: true, ignored: true });
    }
    if (order.status === "Cancelled") {
      return c.json({ success: true, ignored: true, cancelled: true });
    }

    const metadata = callback.CallbackMetadata?.Item || [];
    const findValue = (name: string) => metadata.find((entry) => entry.Name === name)?.Value;

    if (callback.ResultCode === 0) {
      const reportedAmount = Number(findValue("Amount") || order.amountDue || order.total);
      // Never credit more than the remaining balance, regardless of payload.
      const amount = Math.min(
        Number.isFinite(reportedAmount) && reportedAmount > 0 ? reportedAmount : order.amountDue,
        order.amountDue
      );
      const receiptNumber = String(findValue("MpesaReceiptNumber") || "");
      const phoneNumber = String(findValue("PhoneNumber") || order.paymentPhone || "");

      const existingReceipt = isBalancePayment ? order.balanceMpesaReceiptNumber : order.mpesaReceiptNumber;
      if ((receiptNumber && existingReceipt === receiptNumber) || order.amountDue <= 0) {
        return c.json({ success: true, duplicate: true });
      }

      let updated = await recordOrderPayment(order.orderId, Number(amount.toFixed(2)), "mpesa_stk");
      if (updated) {
        const now = new Date().toISOString();
        if (isBalancePayment) {
          await updateOrderPaymentMeta(order.orderId, {
            paymentPhone: phoneNumber || order.paymentPhone,
            paymentReference: receiptNumber || updated.paymentReference,
            balanceMpesaReceiptNumber: receiptNumber,
            balancePaidAt: now,
            paymentLastError: undefined,
          });
          await patchOrder(order.orderId, { balanceDue: 0, balancePaidAt: now });
        } else {
          await updateOrderPaymentMeta(order.orderId, {
            paymentPhone: phoneNumber || order.paymentPhone,
            paymentReference: receiptNumber || updated.paymentReference,
            mpesaReceiptNumber: receiptNumber || updated.mpesaReceiptNumber,
            paymentLastError: undefined,
            mpesaMerchantRequestId: callback.MerchantRequestID || updated.mpesaMerchantRequestId,
            mpesaCheckoutRequestId: callback.CheckoutRequestID || updated.mpesaCheckoutRequestId,
          });
        }
        updated = await awardLoyaltyIfEligible(updated);
      }

      return c.json({ success: true });
    }

    await updateOrderPaymentMeta(order.orderId, {
      paymentLastError: callback.ResultDesc || "M-Pesa payment failed.",
      ...(isBalancePayment
        ? { balanceMpesaMerchantRequestId: callback.MerchantRequestID || order.balanceMpesaMerchantRequestId }
        : {
            mpesaMerchantRequestId: callback.MerchantRequestID || order.mpesaMerchantRequestId,
            mpesaCheckoutRequestId: callback.CheckoutRequestID || order.mpesaCheckoutRequestId,
          }),
    });

    return c.json({ success: true });
  };

  app.post("/api/payments/mpesa/callback", mpesaCallbackHandler);
  app.post("/api/payments/mpesa/callback/:secret", mpesaCallbackHandler);

  // Staff: Get orders ready for pickup/delivery (Shipped)
  app.get("/api/staff/available-orders", async (c) => {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token || !auth) throw new HTTPException(401, { message: "Unauthorized" });

  try {
    const decoded = await auth.verifyIdToken(token);
    const profile = await getUserProfile(decoded.uid, decoded.email);
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
    const profile = await getUserProfile(decoded.uid, decoded.email);
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
      const profile = await getUserProfile(decoded.uid, decoded.email);
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

  // Staff: Request M-Pesa delivery-balance payment (sends STK for remaining balanceDue)
  app.post("/api/staff/orders/:orderId/request-delivery-payment", async (c) => {
    const orderId = Number(c.req.param("orderId"));
    const authHeader = c.req.header("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token || !auth) throw new HTTPException(401, { message: "Unauthorized" });

    let decoded: Awaited<ReturnType<typeof auth.verifyIdToken>>;
    try {
      decoded = await auth.verifyIdToken(token);
    } catch {
      throw new HTTPException(401, { message: "Invalid token" });
    }

    const profile = await getUserProfile(decoded.uid, decoded.email);
    if (profile.role !== "DeliveryAgent") {
      throw new HTTPException(403, { message: "Delivery agents only" });
    }

    const order = await getOrderById(orderId);
    if (!order) throw new HTTPException(404, { message: "Order not found" });
    if (order.assignedAgentId !== decoded.uid) {
      throw new HTTPException(403, { message: "You are not the assigned agent for this order" });
    }
    if (order.status !== "Out for Delivery") {
      throw new HTTPException(400, { message: "Order must be Out for Delivery" });
    }

    const balanceDue = order.balanceDue ?? order.amountDue;
    if (!balanceDue || balanceDue <= 0) {
      throw new HTTPException(400, { message: "No outstanding balance to collect" });
    }

    const phone = order.paymentPhone;
    if (!phone) throw new HTTPException(400, { message: "No payment phone on file for this order" });

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizeMpesaPhone(phone);
    } catch (err) {
      throw new HTTPException(400, { message: err instanceof Error ? err.message : "Invalid phone" });
    }

    try {
      const stk = await initiateMpesaStkPush({
        amount: Math.round(balanceDue),
        phoneNumber: normalizedPhone,
        accountReference: `ORDER-${orderId}-BAL`,
        transactionDesc: `Noir delivery balance for order ${orderId}`,
      });

      await updateOrderPaymentMeta(order.orderId, {
        balanceMpesaMerchantRequestId: stk.merchantRequestId,
        balanceMpesaCheckoutRequestId: stk.checkoutRequestId,
      });

      let updatedOrder = (await getOrderById(orderId)) || order;

      if (stk.mock && balanceDue > 0) {
        // Sandbox: auto-settle the balance payment
        const balanceSettled = await recordOrderPayment(orderId, Math.round(balanceDue), "mpesa_stk");
        if (balanceSettled) {
          await updateOrderPaymentMeta(orderId, {
            balanceMpesaReceiptNumber: stk.receiptNumber || `MOCK-BAL-${orderId}`,
            balancePaidAt: new Date().toISOString(),
          });
          await patchOrder(orderId, { balanceDue: 0, balancePaidAt: new Date().toISOString() });
          // Award loyalty once fully paid
          await awardLoyaltyIfEligible(balanceSettled);
          updatedOrder = (await getOrderById(orderId)) || balanceSettled;
        }
      }

      await appendOrderAudit(orderId, {
        type: "payment_prompt_requested",
        message: `Delivery agent requested balance payment STK (${stk.mock ? "sandbox" : "live"}).`,
        actorId: decoded.uid,
        actorEmail: decoded.email,
      });

      return c.json({
        success: true,
        order: updatedOrder,
        mpesa: { checkoutRequestId: stk.checkoutRequestId, customerMessage: stk.customerMessage, mock: stk.mock },
      });
    } catch (err) {
      if (err instanceof HTTPException) throw err;
      throw new HTTPException(502, { message: err instanceof Error ? err.message : "STK push failed" });
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

  // Admin: Get system logs
  app.get("/api/admin/system-logs", async (c) => {
    const authHeader = c.req.header("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token || !auth) throw new HTTPException(401, { message: "Unauthorized" });

    try {
      const decoded = await auth.verifyIdToken(token);
      const profile = await getUserProfile(decoded.uid, decoded.email);
      if (profile?.role !== "Admin") throw new HTTPException(403, { message: "Admin only" });

      return c.json({ logs: getSystemLogs() });
    } catch (err) {
      if (err instanceof HTTPException) throw err;
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
    const profile = await getUserProfile(decoded.uid, decoded.email);
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
    const profile = await getUserProfile(decoded.uid, decoded.email);
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
      const profile = await getUserProfile(decoded.uid, decoded.email);
      if (profile.role !== "Operator" && profile.role !== "Manager" && profile.role !== "Admin") {
        throw new HTTPException(403, { message: "Operator access required" });
      }
      await next();
    } catch (err) {
      if (err instanceof HTTPException) throw err;
      throw new HTTPException(401, { message: "Invalid token" });
    }
  }

  async function checkMarketing(c: Context, next: Next) {
    const authHeader = c.req.header("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token || !auth) throw new HTTPException(401, { message: "Unauthorized" });
    try {
      const decoded = await auth.verifyIdToken(token);
      const profile = await getUserProfile(decoded.uid, decoded.email);
      if (profile.role !== "Marketing" && profile.role !== "Manager" && profile.role !== "Admin") {
        throw new HTTPException(403, { message: "Marketing access required" });
      }
      await next();
    } catch (err) {
      if (err instanceof HTTPException) throw err;
      throw new HTTPException(401, { message: "Invalid token" });
    }
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
    const profile = await getUserProfile(decoded.uid, decoded.email);
    
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

    if (!targetUserId) throw new HTTPException(400, { message: "Missing user ID" });
    const updated = await updateStaffProfile(targetUserId, body);
    if (!updated) throw new HTTPException(404, { message: "Employee not found" });

    return c.json({ success: true, profile: updated });
  });

  app.put("/api/admin/users/:userId/tier", checkAdmin, async (c) => {
    const targetUserId = c.req.param("userId");
    if (!targetUserId) {
      throw new HTTPException(400, { message: "Missing user ID" });
    }
    let body: { tier?: UserTier };
    try {
      body = await c.req.json();
    } catch {
      throw new HTTPException(400, { message: "Invalid JSON body" });
    }

    const allowedTiers: UserTier[] = ["Junior", "Bronze", "Silver", "Gold", "Platinum", "Black"];
    if (!body.tier || !allowedTiers.includes(body.tier)) {
      throw new HTTPException(400, { message: `Tier must be one of: ${allowedTiers.join(", ")}.` });
    }

    const updated = await setSpecialTier(targetUserId, body.tier);
    return c.json({ success: true, profile: updated });
  });

  app.put("/api/admin/orders/:orderId/status", checkAdmin, async (c) => {
  const orderId = Number(c.req.param("orderId"));
  if (!Number.isFinite(orderId)) {
    throw new HTTPException(400, { message: "Invalid order ID" });
  }

  let body: { status: OrderStatus; cancellationMessage?: string };
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
    const existingOrder = await getOrderById(orderId);
    if (!existingOrder) throw new HTTPException(404, { message: "Order not found" });

    let order: Order | null;
    if (body.status === "Cancelled") {
      const cancellationMessage = body.cancellationMessage?.trim() || "Your order was cancelled. Any pending charges were voided and further payment is disabled.";
      const cancelledOrder = await cancelOrder(orderId, cancellationMessage);
      await reverseOrderFinancials(cancelledOrder ?? existingOrder, "admin");
      await restoreInventoryForOrder(existingOrder, "admin");
      addSystemLog("warning", "OrderCancellation", `Admin cancelled order ${orderId}.`);
      order = await getOrderById(orderId);
    } else {
      order = await updateOrderStatus(orderId, body.status);
    }
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

app.get("/api/orders/me", async (c) => {
  const authHeader = c.req.header("Authorization");
  try {
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const decoded = await verifyAuthToken(idToken);
    const orders = await getOrdersByUser(decoded.uid);
    return c.json({ orders, count: orders.length });
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    console.error("[API] Failed to load authenticated orders:", err);
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
  } else {
    // Guest orders must always be claimed with the matching session ID;
    // deny by default if the order somehow has no session either.
    if (!order.sessionId || !isValidUUID(sessionId) || sessionId !== order.sessionId) {
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
  const indexHtml = readStaticFile("index.html");
  if (indexHtml == null) {
    // Frontend not built — dev mode serves the SPA from Vite on another port.
    return c.text("Frontend build not found. Run `npm run build` or use the Vite dev server.", 404);
  }
  return c.html(indexHtml);
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
