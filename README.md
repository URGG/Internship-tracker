# intern.track

`intern.track` is a private internship and job application tracker built for students and early-career candidates who want a cleaner way to manage the application process.

It keeps saved jobs, applications, deadlines, follow-ups, interview progress, and exports in one place. The core tracker works on its own, and optional AI and search features can be enabled with user-provided keys.

## Overview

This project is split into two parts:

- `intership-finder/`
  React + Vite frontend
- `Backend/`
  FastAPI backend with SQLAlchemy persistence

The product is designed around a free core experience:

- track applications in board, list, and timeline views
- manage deadlines and follow-up dates
- review pipeline progress and weekly activity
- export data to CSV or JSON

Optional extras include:

- live job search
- job link autofill
- auto-hunter subscriptions
- AI cover letters
- resume matching
- follow-up drafting
- company intel

## What It Does

### Application tracking

- Create and manage internship or full-time applications
- Move jobs across stages such as `To Do`, `Applied`, `Interview`, `Offer`, and `Rejected`
- View the pipeline as a kanban board, table, or timeline

### Workflow management

- Track deadlines and next action dates
- Store recruiter names, recruiter emails, referrals, notes, and interview stages
- Keep a simple activity log for status changes and updates

### Search and lead capture

- Search live job listings through an optional RapidAPI-backed flow
- Save search results as leads
- Import job details from a posting URL
- Run auto-hunter subscriptions for recurring searches

### Analytics and review

- See response, interview, and offer rates
- Review source performance
- Track recent activity through weekly review metrics
- Export data whenever needed

### Optional AI tools

- Generate cover letter drafts
- Draft recruiter follow-ups
- Compare resume text against a job description
- Generate company research summaries

## Screenshots

Add screenshots to `docs/images/` and replace the placeholders below.

### Tracker

`[Tracker screenshot placeholder]`

Example:

```md
![Tracker](docs/images/tracker.png)
```

### Search

`[Search screenshot placeholder]`

Example:

```md
![Search](docs/images/search.png)
```

### Analytics

`[Analytics screenshot placeholder]`

Example:

```md
![Analytics](docs/images/analytics.png)
```

### Pricing

`[Pricing screenshot placeholder]`

Example:

```md
![Pricing](docs/images/pricing.png)
```

## Tech Stack

Frontend:

- React
- Vite
- Recharts
- pdfjs-dist

Backend:

- FastAPI
- SQLAlchemy
- bcrypt
- PyJWT
- cryptography
- requests
- google-genai

## Local Development

### Frontend

```bash
cd intership-finder
npm install
npm run dev
```

### Backend

```bash
cd Backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Use Python 3.10+ for backend deployments. `Backend/runtime.txt` pins Python 3.11 for hosts that support runtime files.

## Environment

### Backend

Required:

- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `DATABASE_URL` for production

Optional:

- `APP_ENV`
- `FRONTEND_URL`
- `CORS_ORIGINS`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `PRO_AI_MONTHLY_LIMIT`
- `LIFETIME_AI_MONTHLY_LIMIT`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_MONTHLY_PRICE_ID`
- `STRIPE_LIFETIME_PRICE_ID`

If `DATABASE_URL` is not set, the backend falls back to a local SQLite database for development. Use Postgres or another managed SQL database in production.

Stripe Checkout uses Dashboard-managed payment methods. In Stripe, create one recurring monthly Price and one one-time lifetime Price, put those Price IDs in the backend environment, then enable the payment methods you want in the Stripe Dashboard payment method settings. Configure a webhook endpoint at `/api/billing/webhook` and subscribe to Checkout, subscription, and invoice payment events. Do not add the Stripe secret key to the frontend.

The backend exposes `/api/health` for deployment checks. It reports database reachability and whether Stripe environment variables are configured without exposing secret values.

Paid AI uses the server-owned `GEMINI_API_KEY`. Free users can still add their own Gemini key in Settings. Pro and Lifetime users receive a monthly built-in AI quota, tracked in the `usage_events` table and returned from `/api/billing/me`.

### Frontend

Optional:

- `VITE_API_BASE_URL`

If `VITE_API_BASE_URL` is not set, the frontend uses the production backend URL configured in `intership-finder/src/config.js`.

## Optional API Keys

The tracker itself does not require external API keys.

Optional paid integrations use user-provided keys:

- `RapidAPI`
  Used for live job search and auto-hunter
- `Gemini`
  Used for cover letters, resume match, follow-up drafts, and company intel

This makes the main product usable without forcing every user through external API setup.

## Repository Notes

- This project is proprietary and not open source.
- The current repo contains the production frontend and backend code used for the tracker.
- Legacy unused frontend files and template assets have been removed as part of cleanup.

## License

This project is proprietary. See [LICENSE](LICENSE).
