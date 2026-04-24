# مجلس رواد الأعمال العماني (Omani Entrepreneur Majles)

A complete, fully functional Arabic-RTL multi-vendor marketplace + business platform built with Next.js 14, MongoDB, and Tailwind CSS.

## 🏛️ Modules
1. **Authentication** — NextAuth (credentials) with role-based access (ADMIN / MEMBER / VENDOR / EXPERT)
2. **Memberships** — 4 tiers: FREE, BASIC, GOLD, PLATINUM
3. **Business Directory** — Approved companies catalog with map (Leaflet)
4. **Expert Consultations** — Booking system with availability, ratings, and Thawani/COD payment
5. **Multi-Vendor Marketplace** — Vendor storefronts, products with variants, cart, checkout, orders, wishlist, AI search
6. **Admin Dashboard** — Analytics, user management, approvals center, revenue reports, payouts, coupons

---

## 🚀 Local Development

### 1. Prerequisites
- Node.js ≥ 18
- Yarn (package manager — **never use npm**, breaking change)
- MongoDB instance (local or remote URI)
- Python 3.11+ with venv at `/root/.venv` (for AI Search)

### 2. Install dependencies
```bash
cd /app
yarn install
```

### 3. Run via supervisor (recommended)
The project is wired to supervisor.
```bash
sudo supervisorctl restart nextjs
sudo supervisorctl status
```
The Next.js dev server runs on `0.0.0.0:3000`. Access via the configured `NEXT_PUBLIC_BASE_URL`.

### 4. Logs
```bash
tail -n 100 /var/log/supervisor/nextjs.out.log
```

---

## 🗄️ Database Setup

### MongoDB
- The connection URI is read from `MONGO_URL` in `/app/.env` (do not modify or hardcode).
- The DB schema is defined in `/app/lib/models.js` (Mongoose).
- Collections: `users`, `companies`, `experts`, `products`, `orders`, `appointments`, `memberships`, `coupons`, `payoutrequests`, `promotions`, `stockmovements`, `productreviews`, `carts`, `passwordresettokens`, `availabilities`, `appointments`, `vendorapplications`.

### Seed test data
Test credentials live in `/app/memory/test_credentials.md`. Seeders for products, experts, and companies have been previously executed. Re-run via the relevant seed scripts or the in-app vendor/expert flows.

---

## 🔑 Environment Variables (`/app/.env`)
**Protected — do not modify:**
| Variable | Description |
|---|---|
| `MONGO_URL` | MongoDB connection string (already configured) |
| `NEXT_PUBLIC_BASE_URL` | Public app URL (already configured) |
| `NEXTAUTH_URL` | NextAuth callback origin |
| `NEXTAUTH_SECRET` | NextAuth signing secret |

**Integrations (set as needed):**
| Variable | Used By | Where to obtain |
|---|---|---|
| `EMERGENT_LLM_KEY` | AI Search (Gemini 2.0 Flash via emergentintegrations) | Universal Emergent key |
| `RESEND_API_KEY` | Transactional emails | https://resend.com |
| `THAWANI_PUBLIC_KEY` | Thawani Pay UAT/Production | https://thawani.om |
| `THAWANI_SECRET_KEY` | Thawani Pay UAT/Production | https://thawani.om |
| `THAWANI_BASE_URL` | UAT or production endpoint | UAT: `https://uatcheckout.thawani.om/api/v1` <br> Prod: `https://checkout.thawani.om/api/v1` |

After adding/changing keys, restart:
```bash
sudo supervisorctl restart nextjs
```

---

## 💳 Switching Thawani Pay from UAT to Production
Currently the app runs in **UAT (sandbox)** mode. To enable production:

1. Obtain Production keys from your Thawani merchant dashboard (https://thawani.om).
2. Edit `/app/.env`:
   ```env
   THAWANI_PUBLIC_KEY=<your_production_publishable_key>
   THAWANI_SECRET_KEY=<your_production_secret_key>
   THAWANI_BASE_URL=https://checkout.thawani.om/api/v1
   ```
3. Restart Next.js: `sudo supervisorctl restart nextjs`.
4. Verify a real payment in Production mode using a small test amount.

> The integration code lives in `/app/lib/thawani.js` and is called from the checkout endpoints in `/app/app/api/[[...path]]/route.js`. The UI placeholder button is `/app/components/ThawaniPlaceholder.jsx` (with `// TODO: Replace with Thawani Pay API key and endpoint` comments).

---

## 🤖 AI Semantic Search
- Endpoint: `POST /api/products/ai-search` body `{ "query": "..." }`
- Backend: spawns `/app/lib/ai_search.py` via `child_process` using `/root/.venv/bin/python3`.
- Model: **Gemini 2.0 Flash** (cheapest tier via `emergentintegrations`).
- Constraints: filters are restricted to **actual catalog values** (categories + popular tags fetched live from MongoDB) to prevent hallucinations and reduce token cost.
- Caching: in-memory LRU cache (5 min) on identical queries → ~80ms response on cache hit.

---

## 📁 Key Folders
```
/app
├── app/
│   ├── api/[[...path]]/route.js   # Monolithic API (~5500 lines, modular helpers in /lib)
│   ├── admin/                      # Admin dashboard (analytics, users, approvals, revenue, payouts, coupons, etc.)
│   ├── store/                      # Marketplace (browse, product detail, cart, checkout, wishlist, vendor pages)
│   ├── consultations/              # Expert consultation booking
│   ├── directory/                  # Business directory
│   ├── dashboard/vendor/           # Vendor dashboard (products, orders, analytics, inventory, promotions, payouts)
│   ├── membership/                 # Membership tiers
│   └── page.js                     # Landing page (server-rendered with featured data)
├── components/
│   ├── Navbar.jsx, Footer.jsx
│   ├── Skeleton.jsx, EmptyState.jsx
│   ├── ThawaniPlaceholder.jsx      # TODO: replace with real Thawani trigger
│   └── ui/                         # shadcn components
├── lib/
│   ├── db.js                       # MongoDB connector (singleton)
│   ├── models.js                   # Mongoose schemas (UUIDs only — no ObjectIds)
│   ├── auth.js                     # NextAuth options
│   ├── ai_search.py                # AI Search Python helper (Gemini)
│   ├── thawani.js                  # Thawani Pay client
│   ├── inventory.js, variants.js, promotions.js, payouts.js, tags.js
│   └── api/                        # Modular handlers (coupons, etc.)
└── .env                            # Protected — do not modify
```

---

## 👤 Test Credentials
See `/app/memory/test_credentials.md`.

- **Admin:** `mazin298@gmail.com`
- **Test Vendor:** `vendor_var_1777053820@example.com`

---

## 🧪 Testing
- **Backend:** `deep_testing_backend_nextjs` agent (test_result.md driven).
- **Frontend:** `deep_testing_frontend_nextjs` agent (only with explicit user permission).
- All testing state lives in `/app/test_result.md`.

---

## 🌐 Roadmap (Next Phases)
- 📱 PWA (manifest + service worker + offline cache)
- 🔔 Web-Push Notifications (VAPID keys)
- 🌍 i18n (Arabic/English toggle)
- 🔄 Production Thawani Pay (awaiting merchant keys)

---

© 2025 مجلس رواد الأعمال العماني — جميع الحقوق محفوظة.
