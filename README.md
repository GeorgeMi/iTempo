# iTempo

> Smart scheduling for independent professionals. Appointments, clients, payments — minimal, fast, responsive.

iTempo is a self-hosted web app for anyone who runs paid 1-on-1 sessions: tutors, therapists, coaches, trainers, consultants, hairstylists. One place for your calendar, clients, services and income — no client logins, no payment processing, no clutter.

Each professional has their own isolated account. Data never crosses accounts.

---

## Features

**Calendar**
- Day / Week / Month / Year views
- Drag-and-drop to reschedule or resize
- Click-to-create on any empty slot
- Mobile defaults to Day view, desktop to Week

**Smart booking modal**
- Per-day timeline on the right: see busy blocks for every other client at a glance
- Real-time conflict detection — warns you before you double-book
- Click the timeline to jump the start time

**Recurrence**
- Weekly · Bi-weekly · Monthly
- Edit a single occurrence without breaking the series (materialized exceptions)
- Optional end date per rule

**Payments (manual tracking)**
- Toggle "paid" per appointment — no bank integration
- Dashboard surfaces unpaid sessions at a glance

**Reports**
- Revenue (collected / due) · Hours worked · Session count
- **Upcoming projection**: estimated revenue and hours from scheduled future sessions
- Revenue over time (stacked area chart: collected + due + estimated)
- Breakdown by service (stacked bars) and by client (progress bars)
- Filter by period / service / client
- CSV export

**Internationalization**
- Romanian and English, switchable from the sidebar
- Per-user default locale stored with the account

**Responsive + PWA**
- Tailored layouts for phone, tablet, desktop
- Install to home screen (iOS / Android)
- Dark mode with system detection

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| UI | Tailwind CSS + Radix primitives + shadcn-style components |
| Calendar | FullCalendar (timeGrid, dayGrid, multiMonth, interaction) |
| Charts | Recharts |
| i18n | next-intl (RO / EN) |
| Database | Prisma — SQLite (dev) / Postgres via Neon (prod) |
| Auth | Auth.js v5 (credentials + JWT, bcrypt) |
| Deploy | Vercel Hobby (free tier) |

---

## Local development

```bash
npm install
cp .env.example .env
npx prisma db push
npm run dev
```

Open `http://localhost:3000` and create an account.

### Environment

```bash
DATABASE_URL="file:./dev.db"      # SQLite for dev
AUTH_SECRET="<run: openssl rand -base64 32>"
ALLOW_SIGNUP="true"               # set to "false" after your account is created
```

### Useful scripts

```bash
npm run dev          # dev server
npm run build        # production build (runs prisma generate)
npm run db:push      # sync schema to DB
npm run db:studio    # open Prisma Studio (visual DB browser)
npm run db:seed      # create demo user (demo@itempo.app / demodemo)
```

---

## Deploy to Vercel (free)

1. **Push to GitHub** — `git push origin main`.
2. **Import on Vercel** — [vercel.com/new](https://vercel.com/new), select the repo.
3. **Add a database** — in the Vercel dashboard: `Storage → Create Database → Neon`. Vercel injects `DATABASE_URL` automatically.
4. **Switch Prisma to Postgres** — in `prisma/schema.prisma`, change:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
   Commit and push.
5. **Add env vars** in Vercel → Settings → Environment Variables:
   - `AUTH_SECRET` — generate with `openssl rand -base64 32`
   - `ALLOW_SIGNUP=true` during setup; flip to `false` after you create your account to lock the app down
6. **Deploy**. First visit opens the landing page — sign up, then disable signups.

Vercel Hobby gives you 100 GB bandwidth/month and Neon Free gives 0.5 GB storage — easily enough for years of personal scheduling data.

---

## Data model

```
User           — one account per professional (email + password)
 ├── Client    — people you schedule with (name, contact, color, optional rate override)
 ├── Service   — what you offer (default duration + price + color)
 ├── Appointment    — concrete session (client, service, start/end, price, status, paid)
 └── RecurringRule  — repeat pattern (weekly/biweekly/monthly) that generates virtual occurrences
```

**Price cascade (most specific wins):**
1. Appointment `price` (snapshot, editable per session)
2. Client `defaultRate` (if set)
3. Service `defaultPrice` (fallback)

**Duration** defaults to the service's `defaultDuration`, overridable per appointment.

**Recurring occurrences** are computed on the fly from rules. Edit or cancel a single slot → it materializes into an `Appointment` row with `originalStart` pointing to the canonical slot. The series continues undisturbed. Exceptions moved to a different month are still tracked correctly in reports.

---

## Security model

- `userId` always comes from the server-side session (JWT signed with `AUTH_SECRET`), never from client input.
- Every query filters by `userId` — no cross-tenant leaks possible, even with a guessed ID.
- Passwords hashed with bcrypt (cost 10).
- Protected routes blocked by middleware when unauthenticated.
- Cross-reference integrity: when creating an appointment, the server verifies the referenced client and service belong to the same user.
- `ALLOW_SIGNUP=false` locks new signups after you've set up your account.

### Is the database safe on Vercel + Neon?

Short answer: **yes, in the standard setup.**

- Neon databases are private (credentialed, SSL-forced, no public URL).
- Credentials stay in encrypted Vercel environment variables.
- Data is isolated per account via `userId` filtering in every query.
- Passwords are bcrypt-hashed; even a DB dump doesn't expose them in the clear.

What **you** must do:
- Pick a strong `AUTH_SECRET` (32+ random bytes).
- Pick a strong login password.
- Turn on 2FA for your Vercel and Neon accounts.
- Set `ALLOW_SIGNUP=false` once your account exists.
- Never commit `.env` files (already in `.gitignore`).

What's out of scope:
- No end-to-end encryption. Neon and Vercel can technically read your data (same as any cloud provider). Fine for scheduling; not suitable for HIPAA-grade medical records.

---

## Project layout

```
app/
  [locale]/
    signin, signup              — auth pages
    (app)/                      — authenticated shell + pages
      dashboard, calendar, clients, services, reports, settings
    layout.tsx                  — fonts, theme, i18n provider
    page.tsx                    — public landing
  api/auth/[...nextauth]        — Auth.js route
components/
  ui/                           — shadcn-style primitives
  layout/                       — sidebar, topbar, locale switcher, theme toggle
  calendar/                     — FullCalendar mount + appointment dialog + day timeline
  common/                       — shared pieces (color picker, etc.)
lib/
  actions/                      — server actions (clients, services, appointments, auth, settings)
  prisma.ts                     — Prisma client singleton
  recurrence.ts                 — rule → occurrence expansion with exception handling
  validators.ts                 — Zod schemas for all server inputs
  utils.ts                      — cn, money/duration formatters, color palette
i18n/                           — next-intl routing + request config
messages/                       — ro.json, en.json
middleware.ts                   — locale routing + auth guard
prisma/schema.prisma            — data model
auth.ts                         — NextAuth config + requireUserId helper
```

---

## Roadmap ideas

- Email reminders (Resend) — optional, opt-in per client
- iCal export / two-way Google Calendar sync
- Invoice generation (PDF)
- Multi-location support
- Client portal (read-only public link to upcoming sessions)
- Keyboard shortcuts (`N` new appointment, `T` today)
- Offline-first with local cache

---

## License

Private / personal use. Adapt as you like.
