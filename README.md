# Comanda

> **Leggi in italiano:** [README-it.md](./README-it.md)

A fullstack MERN web application for a Chinese cuisine and pizza restaurant. It replaces paper order pads with a shared digital workflow between the dining room and the kitchen, while giving guests a bilingual QR menu and online table booking.

**Live demo:** https://comandafrontend.vercel.app/

---

## The idea: how it started

The name **Comanda** comes from the Italian restaurant word for the 'paper slip' a waiter writes at the table and hands to the kitchen.

While studying computer science at a State Industrial Technical Institute (ITIS), I worked part-time as a waiter in a Chinese restaurant and pizzeria. During busy dinner services, the same problems happened every night:

* **Paper order pads slowed everyone down:** running back and forth to the kitchen, rushed handwriting that cooks struggled to read, and the occasional forgotten table.
* **Tourists struggled with the menu:** foreign guests couldn't read Italian descriptions and constantly needed help understanding ingredients and allergens.

I built Comanda around a menu based on the one I worked with, under a fictional restaurant name, to solve those exact bottlenecks.

One deliberate choice: **guests never place orders from their phones**. In a sit-down restaurant, the waiter keeps the human connection with the table, answers questions, and paces the meal. The app assists the staff. It doesn't replace them.

---

## What it does

### Guest (no account required)
Guests scan a single QR code to open the menu in **Italian or English** (detected from the browser and saved locally). They browse one category at a time, search across the whole menu by dish name or code, check allergens and frozen-item markers, and save dishes to **"La mia lista"**: a local bookmark list with Italian names and dish codes designed to be shown directly to the waiter. Guests can also book a table online using only available time slots.

### Waiter (mobile-first)
Replaces the paper pad. Waiters view a live table grid (free, occupied, preparing, ready), open a table to check its current orders and running total, and send new tickets directly to the kitchen by searching dish codes. When dishes are ready, a **"Pronto"** banner alerts the floor. At the end of the meal, **"Libera tavolo"** closes all open tickets for that table and shows the final bill.

### Kitchen (tablet landscape)
A three-column board (**Da iniziare**, **In preparazione**, **Pronto**) with large, readable ticket cards showing table number, course round, quantities, and notes. Cooks can also mark out-of-stock dishes as *"Esaurito"* so waiters cannot accidentally order them. Because cooks work fast with wet or flour-covered hands, moving a ticket forward triggers an instant UI move with a **5-second undo toast** instead of blocking them with a popup.

### Owner / Admin (desktop)
A management dashboard with live service stats, a dining room overview, full CRUD for dishes and categories (including Cloudinary photo uploads), booking approvals for large groups, and restaurant settings (opening hours, closed days, table capacity). It also includes a **"View as"** switcher that lets the admin temporarily step into a waiter or kitchen account for 30 minutes to test permissions or help during a rush.

---

## Decisions I'm proud of

* **Unverified bookings hold no seats and expire after 30 minutes:** Guests receive a confirmation email link after submitting the booking form. Until they click it, the reservation stays `awaiting_verification` and does not block table availability for other guests. A MongoDB TTL index automatically deletes unconfirmed bookings after 30 minutes.
* **Confirmation dialogs everywhere, except the kitchen's undo:** Every action that changes data (sending a ticket, closing a table, deleting a dish, cancelling a booking) asks for explicit confirmation via a native `<dialog>` modal with specific details, such as the table total, to prevent misclicks. The kitchen board is the deliberate exception: a 5-second undo toast delays the API call so cooks aren't slowed down by modals during a rush.
* **One ticket per send to the kitchen:** Every time a waiter sends items for a table, the backend creates a separate ticket (`1ª comanda`, `2ª comanda`, etc.) with price and name snapshots. Starters, mains, and desserts flow independently through the kitchen, and past orders remain accurate even if menu prices change later.
* **Capacity counted in tables, not individual seats:** A party of two still occupies a four-seat table. Availability checks `Math.ceil(partySize / seatsPerTable)` across the entire 90-minute dining window (`[start, start + avgDuration)`), while keeping 14 of the 50 tables reserved for walk-ins.

---

## Tech stack

* **Frontend:** React 19, Vite, React Router v7, Axios, Sonner, `qrcode.react`. Styled with **plain CSS and CSS Modules** (using design tokens in `tokens.css`) rather than a UI library, so I had full control over responsive layouts, glassmorphism bars, print styles for the QR page, and native `<dialog>` modals without fighting framework overrides.
* **Backend:** Node.js (v20+), Express 5, MongoDB Atlas & Mongoose, JWT (`jsonwebtoken` + `bcrypt`), Multer & Cloudinary (image uploads), SendGrid (transactional emails), Cloudflare Turnstile (bot protection).
* **Hosting:** Deployed on **Vercel** (frontend) and **Render** (backend) with **MongoDB Atlas**. This is the stack I learned during my EPICODE course, chosen for zero-cost hosting and smooth JSON document modeling.

---

## Run it locally

### Prerequisites
* Node.js **v20+**
* Accounts and keys for MongoDB Atlas, Cloudinary, and SendGrid. The `.env.example` files already contain Cloudflare's public test keys, which work locally.

### Setup
1. **Clone the repository and install dependencies:**
   ```bash
   git clone https://github.com/devHP-source/comanda.git
   cd comanda
   npm run install:all
   ```

2. **Configure environment variables:**
   Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env`, then fill in your credentials:
   * `backend/.env`: set `PORT=9099`, `FRONTEND_URL=http://localhost:5173`, your `MONGODB_URI`, `JWT_SECRET`, Cloudinary, SendGrid, and seed staff credentials. Keep the prefilled Cloudflare test secret key for local development.
   * `frontend/.env`: set `VITE_API_URL=http://localhost:9099/api` and keep the prefilled Cloudflare test site key.

3. **Seed the database:**
   ```bash
   npm run seed --prefix backend
   ```
   *(Warning: the seed resets the database MONGODB_URI points to: it recreates categories, dishes and settings, and deletes orders and reservations. Optional: place dish photos named by dish code like `47.jpg` in a folder outside the repo and set `SEED_IMAGES_DIR` in `backend/.env` to upload them to Cloudinary automatically. Otherwise, dishes use clean CSS placeholders.)*

4. **Start both servers:**
   ```bash
   npm run dev
   ```
   * **Frontend:** `http://localhost:5173` (staff login at `/staff/login`; demo staff credentials are shared separately in the EPICODE submission)
   * **Backend:** `http://localhost:9099` (health check at `/api/health`)

---

## API overview

All endpoints are prefixed with `/api` and return consistent `{ message, code }` errors.

| Domain | Endpoints | Access |
| :--- | :--- | :--- |
| **System** | `GET /health` | Public |
| **Auth** | `POST /auth/login`, `GET /auth/me`, `POST /auth/impersonate/:userId` | Staff / Admin |
| **Categories** | `GET /categories`, `POST /categories`, `PUT/DELETE /categories/:id` | Public (read), Admin (write) |
| **Dishes** | `GET /dishes`, `GET /dishes/:id`, `PATCH /dishes/:id/availability`, `POST /dishes`, `PUT/DELETE /dishes/:id` | Public (read), Staff (availability), Admin (CRUD) |
| **Admin** | `GET /admin/dishes` (paginated, search, category filter), `GET /admin/dishes/:id`, `GET /admin/categories` | Admin |
| **Orders** | `GET /orders`, `POST /orders`, `PATCH /orders/:id/status` | Staff |
| **Tables** | `GET /tables`, `POST /tables/:number/close` | Waiter, Admin |
| **Reservations** | `GET /reservations/slots`, `POST /reservations`, `GET /reservations/verify/:token`, `GET/POST /reservations/cancel/:token` | Public |
| **Reservations (Staff)** | `GET /reservations`, `GET /reservations/:id/free-tables`, `PATCH /reservations/:id/status` | Waiter (read today), Admin (manage) |
| **Settings & Users** | `GET /settings/public`, `GET/PUT /settings`, `GET /users` | Public (`/public`), Admin |

---

## Testing with Bruno

An API collection is included in `bruno/` covering authentication, full dining-room-to-kitchen service flows, reservations, and 19 NoSQL injection security tests.

1. Open `comanda/bruno/` in the **Bruno** desktop app.
2. Create `bruno/.env` with the same `SEED_ADMIN_*`, `SEED_WAITER_*`, and `SEED_KITCHEN_*` variables used in `backend/.env`.
3. Select the `local` environment and run the collection with the Bruno Runner while your backend is running.

---

## Security

* **Authentication & RBAC:** Staff passwords are hashed with `bcrypt` (10 rounds). JWTs enforce `HS256` and reload the user from MongoDB on every request so deactivated accounts are blocked immediately. Role permissions are enforced server-side via `authorize` middleware.
* **Impersonation guard:** "View as" tokens expire after 30 minutes and automatically invalidate if the original admin account is deactivated.
* **NoSQL injection protection:** Mongoose `sanitizeFilter` is enabled globally, all query inputs from `req.body` and `req.params` undergo strict type checks, and trusted internal operators are explicitly wrapped in `mongoose.trusted()`.
* **XSS & header hardening:** `helmet` secures HTTP headers, CORS is locked to the frontend origin, React escapes all UI output without `dangerouslySetInnerHTML`, and guest inputs are HTML-escaped in emails.
* **Bot & spam prevention:** Public booking requests require server-side **Cloudflare Turnstile** verification and are throttled by both per-IP rate limits and a maximum of 3 open bookings per email per hour.
* **Token privacy:** Booking verification and cancellation tokens are generated with `crypto.randomBytes(32)`, masked in Morgan request logs, and sent with SendGrid click-tracking disabled.

---

## Known limits and what's next

### Known limits
* **Simultaneous booking race condition:** Capacity is checked before saving without a database transaction lock, meaning two bookings submitted at the exact same millisecond could both pass (absorbed in practice by the 14 walk-in tables).
* **Email deliverability:** Transactional emails are sent via SendGrid's free tier from a single verified sender without a custom authenticated domain, which can occasionally cause delays or spam filtering.
* **Cold starts:** Render's free tier puts the backend to sleep after ~15 minutes of inactivity, so the first request may take 30 to 60 seconds (handled on the frontend with a friendly loading message).
* **Polling vs. WebSockets:** Kitchen and waiter screens refresh every 5 seconds via visibility-aware polling rather than real-time sockets.

### What's next
* Optional Google OAuth login for guests (with a *"My Bookings"* history page) and for the restaurant owner.
* Per-table QR codes with active table sessions and a *"Call waiter"* button.
* Real-time kitchen updates using Socket.io.
* Additional menu languages (Chinese, Spanish, French).

---

## Credits

* **Author:** Gideon Paulo Alipio Del Poso ([@devHP-source](https://github.com/devHP-source)), EPICODE Full-Stack Web Developer Capstone Project (2026).
* **Inspiration:** Built from my experience working part-time as a waiter in a Chinese restaurant and pizzeria during my technical high school studies. *Comanda* is a fictional restaurant name.
* **Photography:** Dish photos sourced from [Pexels](https://www.pexels.com/).
