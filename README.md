# NOIR Perfume

A luxury fragrance e-commerce storefront built with **React + TypeScript + Vite** on the frontend and **Hono** on the backend.

## Current Status

### Frontend
- **20-product catalogue** featuring house scents (NOIR, Maison Obscura, Attar Royal, Haus Alchemy) alongside iconic real-world fragrances (Tom Ford Lost Cherry, Creed Aventus, Dior Sauvage, Chanel Bleu de Chanel, and more).
- **Responsive landing page** with glassmorphism design, gold-gradient accents, and premium animations (Framer Motion).
- **Interactive Scent Finder quiz** — 3-step profiler that matches users to fragrances based on drive, element, and occasion.
- **Live search overlay** with filtering by name, brand, and scent notes.
- **Product showcase** with brand/collection filters, scent pyramids, longevity/sillage meters, and staggered grid animations.
- **Cart system** (React Context + localStorage):
  - Add to bag from any product card
  - Slide-over cart drawer with quantity controls
  - Live subtotal calculation
  - Persistent cart across reloads
- **Toast notifications** (Sonner) for add-to-bag and checkout feedback.

### Backend
- **Hono server** running on `http://localhost:3001`
- RESTful API endpoints:
  - `GET /api/health` — health check
  - `GET /api/products` — full product list
  - `GET /api/cart/:sessionId` — retrieve cart
  - `POST /api/cart/:sessionId` — add/update cart item
  - `DELETE /api/cart/:sessionId/:productId` — remove cart item
  - `POST /api/checkout` — place order and clear cart
  - `GET /api/orders` — list all orders

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, shadcn/ui |
| State | React Context, localStorage |
| Backend | Hono, `@hono/node-server`, TypeScript |
| Tools | ESLint, tsx, concurrently |

## Running Locally

### Start both frontend and backend
```bash
npm run dev:full
```
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

### Start frontend only
```bash
npm run dev
```

### Start backend only
```bash
npm run server
```

### Build for production
```bash
npm run build
```

### Lint
```bash
npm run lint
```

## What's Next
- [ ] Sync frontend cart with backend API using a session UUID
- [ ] Swap in-memory storage for a real database (SQLite / PostgreSQL)
- [ ] Add user authentication (JWT / Clerk / Auth0)
- [ ] Integrate real payments (Stripe / PayPal)
- [ ] Admin dashboard for order management
- [ ] Email confirmations on checkout
