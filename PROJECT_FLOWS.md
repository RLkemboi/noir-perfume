# Project Flow Diagrams

## Files
- diagrams/index.html — Interactive flow viewer (open in browser)
- diagrams/00_user_flow_skeleton.mmd — Plain-language user journey: browse, checkout, account, staff portals
- diagrams/01_frontend.mmd — React 19 app: routing tree, auth guards, role-based portals, Firebase + API connections
- diagrams/02_backend.mmd — Hono API: all routes grouped by domain (Products, Cart, Checkout, Orders, Admin, Staff)
- diagrams/03_middleware.mmd — Request pipeline: CORS → COOP → auth middleware → route handler → error handler

## How to view
Open `diagrams/index.html` in any browser. Use the layer buttons to switch between:
- **User Journey** — plain-language user flow, no technical terms
- **Backend Flow** — React app routing and Hono API routes with role checks and DB access
- **Middleware** — request auth pipeline (CORS, Firebase token verification, role guards)

## Bugs and dead code spotted
- server/index.ts:1045-1046 — Duplicate handler: both `/api/orders/:orderId/cancel` and `/api/orders/:orderId/customer-cancel` map to the same `handleCustomerOrderCancellation` function. The second alias appears to be an undocumented backward-compat route with no comment explaining why it exists.
- server/index.ts:146 and server/index.ts:171 — Two separate Firebase token verification helpers (`getAuthenticatedUser` and `verifyAuthToken`) with overlapping logic. `verifyAuthToken` has better config-mismatch detection; `getAuthenticatedUser` is used in some routes instead.
- server/middleware/auth.ts and server/index.ts:1507 — `adminAuthMiddleware` (external file) and `checkAdmin` (inline function) both check Admin role via Firebase token but are separate implementations. Used inconsistently across routes.
- server/index.ts:1502 — `GET /api/marketing/vip-users` returns a stub message ("VIP data restricted to production DB") rather than real data. The endpoint is accessible in production but non-functional.
