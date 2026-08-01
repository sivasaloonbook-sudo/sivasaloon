# Siva Saloon — Online Booking Management System

## Structure
```
siva-saloon/
├── index.html                Landing page
├── assets/logo.png           Your logo
├── css/style.css             Shared design system
├── customer/
│   ├── index.html            OTP login
│   ├── dashboard.html        Slot picker + booking history
│   └── profile.html          Profile edit
├── admin/
│   ├── index.html            Admin login
│   ├── dashboard.html        Live overview stats
│   ├── bookings.html         Booking management
│   ├── customers.html        Customer management
│   ├── employees.html        Employee management (capacity control)
│   ├── coupons.html          Coupon management
│   ├── payments.html         Billing, invoice print, payment verify
│   └── reports.html          Revenue analytics
├── api/                      Vercel serverless functions (Node)
│   ├── _lib/                 Shared: Supabase admin client, auth/cookies, Telegram
│   ├── admin/                Admin-only endpoints (session-gated)
│   └── *.js                  Public + customer endpoints
├── scripts/create-admin.js   One-time local script to create an admin login
└── sql/schema.sql            Full Supabase schema — run once
```

## Setup (in order)

1. **Database** — open your Supabase project's SQL editor and run `sql/schema.sql`.

2. **Environment variables** — in Vercel: Project Settings → Environment Variables,
   add everything listed in `.env.example`:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-side only), `SUPABASE_ANON_KEY`
   - `MSG91_AUTH_KEY`, `MSG91_OTP_TEMPLATE_ID`
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
   - `JWT_SECRET` (any long random string — `openssl rand -hex 32`)

3. **Install dependencies locally** (needed once, to run the admin-creation script):
   ```
   npm install
   ```

4. **Create your first admin login**:
   ```
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-admin.js yourname yourpassword
   ```

5. **Add at least one service and one employee** — the booking picker needs both
   to show any slots. Easiest for now: insert directly in the Supabase table
   editor (e.g. a "Haircut" service at ₹150, one employee marked active).
   The Employee Management admin page can add more staff after that.

6. **Deploy to Vercel** — connect the GitHub repo, Vercel auto-detects the
   `api/` folder as serverless functions. No extra config needed.

## How it fits together
- **OTP login**: `customer/index.html` → `/api/send-otp` and `/api/verify-otp`
  → MSG91 → on success, upserts a `customers` row and sets an httpOnly session cookie.
- **Booking**: `customer/dashboard.html` reads `/api/services` + `/api/slots`
  (slots are computed live from shop hours, lunch break, and active employees —
  no cron job needed), then posts to `/api/create-booking`, which re-checks the
  slot is free, applies any coupon, creates the `bookings` + `bills` rows, and
  sends a Telegram notification.
- **Admin**: `admin/index.html` → `/api/admin-login` checks a bcrypt hash from
  the `admins` table and sets a separate session cookie. All `/api/admin/*`
  routes require that cookie.
- **Capacity scaling**: adding an active employee in `admin/employees.html`
  automatically produces a new column of slots on the booking picker — the
  slot grid is generated per active employee on every request, not stored.

## Known gaps to close next
- **Profile photo upload**: the file input in `customer/profile.html` doesn't
  upload anywhere yet. Needs a Supabase Storage bucket + a small upload call
  before saving `profile_photo_url`.
- **RLS policies**: `sql/schema.sql` enables RLS on the sensitive tables but
  leaves policies mostly open, relying on the service-role key server-side.
  Fine for launch since the browser never touches Supabase directly, but worth
  tightening if you ever add direct client-side Supabase calls.
- **Multiple services per booking**: the booking flow currently defaults to
  the first active service. Once you add more services (beard trim, facial,
  etc.), the picker UI needs a service selector added.
