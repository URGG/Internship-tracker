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
- export data to CSV or JSON and restore JSON backups

Optional extras include:

- live job search
- job link autofill
- saved auto-hunter searches that can be run manually
- AI cover letters
- resume matching
- follow-up drafting
- company intel
- application packets with fit scoring, truthful resume bullets, application answers, interview prep, and next actions
- reusable application profile with review-first browser autofill for supported forms

Supabase currently provides the Postgres database only. Authentication is handled by the backend's own JWT/bcrypt user table; Supabase Auth users are not automatically recognized by this application.

Team workspaces are available through the application auth layer. Each account receives a private default workspace, and members can be added by existing username/email or invited with a signed, expiring link. Applications, saved hunts, analytics, usage, and activity events are scoped to the active workspace.

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

- Search live job listings through a provider-agnostic flow (JSearch/RapidAPI plus optional USAJOBS)
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

### Application profile and browser helper

- Complete common identity, contact, education, authorization, and reusable-answer fields once in Settings.
- Open an application from the tracker with `Apply Assist`, then click the intern.track browser extension on the employer form.
- The extension fills only recognizable, non-sensitive fields and leaves demographic, identity, CAPTCHA, password, and file-upload questions for the user.
- The user reviews every field and submits directly on the employer's site. Universal background submission is intentionally not supported.

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
- `JWT_TTL_DAYS`
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
- `TURNSTILE_SECRET_KEY` to require Cloudflare Turnstile verification on signup and login
- `TURNSTILE_EXPECTED_HOSTNAME` to restrict verification to the deployed frontend hostname
- `RAPIDAPI_KEY` is optional; leave it unset when each user enters their own key in Settings
- `USAJOBS_API_KEY` and `USAJOBS_USER_AGENT` are optional; set both only after requesting and accepting access under the USAJOBS API terms
- `TERMS_URL` and `PRIVACY_URL` should point to the deployed, attorney-reviewed policies; `COOKIES_URL`, `DISCLAIMER_URL`, and `ACCEPTABLE_USE_URL` can point to the matching public legal pages
- `TERMS_VERSION` and `PRIVACY_VERSION` identify the policy versions recorded at signup
- `REQUIRE_LEGAL_CONSENT=true` requires current Terms and Privacy acceptance before account creation (enabled automatically in production)
- `LEGAL_ENTITY_NAME`, `LEGAL_CONTACT_EMAIL`, `LEGAL_BUSINESS_ADDRESS`, `MINIMUM_AGE`, and `REQUIRE_AGE_CONFIRMATION` configure the public legal pages and age policy
- `REQUIRE_EMAIL_VERIFICATION`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, and `SMTP_USE_TLS` enable verification and password-reset delivery
- `AUTH_SESSION_REQUIRED=true` enables server-side session revocation; `MFA_ISSUER` names the authenticator-app issuer
- MFA is optional and is enrolled after sign-in from Settings. Login only asks for an authenticator code when the account has already enabled MFA.

If `DATABASE_URL` is not set, the backend falls back to a local SQLite database for development. Use Postgres or another managed SQL database in production.

For local development, use the ignored `Backend/.env` file with development values for `JWT_SECRET` and `ENCRYPTION_KEY`. The app loads it relative to `Backend/main.py`, so it works regardless of whether Uvicorn is started from the repository root or from `Backend/`. Render does not use this local file: set the production Supabase `DATABASE_URL`, secrets, and CORS values in the Render service environment. Live job search can use a user's RapidAPI key entered in Settings.

### Render deployment checklist

Set these environment variables on the Render backend service before deploying:

- `APP_ENV=production`
- `DATABASE_URL` pointing to the Supabase Postgres connection string
- `FRONTEND_URL` set to the exact deployed frontend origin
- `CORS_ORIGINS` containing the frontend origin and, if needed, the browser extension origin
- `JWT_SECRET` and `ENCRYPTION_KEY` set to stable, long-lived secrets
- `JWT_TTL_DAYS` can be set to control access-token lifetime; the default is 7 days
- `TURNSTILE_SECRET_KEY` and `TURNSTILE_EXPECTED_HOSTNAME` if bot protection is enabled

Recommended Render service settings are `Root Directory: Backend`, `Build Command: pip install -r requirements.txt`, `Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT`, and `Health Check Path: /api/health`. Copy the complete Postgres connection string from Supabase Project Settings > Database > Connect into Render's `DATABASE_URL`; do not use the frontend Supabase URL or anon key. The included `render.yaml` is a secret-free Blueprint template for these settings.

After deployment, open `/api/health`. A healthy production response should report `database: "ok"`, `database_backend: "postgresql"`, `environment: "production"`, and all schema flags as `true`. If built-in paid AI is enabled, it should also report `server_gemini_configured: true`.

Stripe Checkout uses Dashboard-managed payment methods. In Stripe, create one recurring monthly Price and one one-time lifetime Price, put those Price IDs in the backend environment, then enable the payment methods you want in the Stripe Dashboard payment method settings. Configure a webhook endpoint at `/api/billing/webhook` and subscribe to Checkout, subscription, and invoice payment events. Do not add the Stripe secret key to the frontend.

The backend exposes `/api/health` for deployment checks. It reports database reachability and whether Stripe environment variables are configured without exposing secret values.

Application analytics are calculated from the server-side `application_events` ledger rather than only from the current status column. Product activity and built-in AI usage are tracked separately in `usage_events`, including feature-level units for the current billing month.

### Job provider and data-use safeguards

Search uses provider adapters and normalizes results into a shared response shape. JSearch/RapidAPI and USAJOBS are independent providers; one provider can fail without taking down another. Results retain provider IDs, source URLs, attribution, terms URLs, and fetch timestamps when saved as leads. Search results are deduplicated before they reach the UI, and API credentials are never sent to the browser.

Before enabling a provider in production, review its current API agreement and confirm that the intended display, storage, attribution, caching, and redirect behavior are permitted. USAJOBS results must remain credited and users must be directed to USAJOBS to view/apply; the application therefore preserves a USAJOBS source URL and attribution on saved leads. This implementation is compliance plumbing, not legal advice or a substitute for counsel review.

### Schema migrations and verification

The backend keeps startup compatibility checks for existing deployments and now includes an idempotent Alembic foundation migration. For a controlled release, run this from `Backend/` before starting the service:

```bash
alembic upgrade head
```

The repository CI workflow verifies backend tests and compilation, frontend lint/build, and the browser extension syntax on every push and pull request.

Paid AI uses the server-owned `GEMINI_API_KEY`. Free users can still add their own Gemini key in Settings. Pro and Lifetime users receive a monthly built-in AI quota, tracked in the `usage_events` table and returned from `/api/billing/me`.

### Frontend

Use Node `20.19.0` or newer for the Vite 8 build. The repository includes `.nvmrc` with the tested version.

Optional:

- `VITE_API_BASE_URL`
- `VITE_TURNSTILE_SITE_KEY` to show the Cloudflare Turnstile widget in the auth modal; leave unset to keep Turnstile disabled
- `VITE_TERMS_URL`, `VITE_PRIVACY_URL`, `VITE_COOKIES_URL`, `VITE_DISCLAIMER_URL`, and `VITE_ACCEPTABLE_USE_URL` configure the public legal-page links
- `VITE_TERMS_VERSION`, `VITE_PRIVACY_VERSION`, `VITE_LEGAL_ENTITY_NAME`, `VITE_LEGAL_CONTACT_EMAIL`, `VITE_MINIMUM_AGE`, and `VITE_POLICY_EFFECTIVE_DATE` populate the public policy pages and should match the backend configuration

See [docs/COMPLIANCE_CHECKLIST.md](docs/COMPLIANCE_CHECKLIST.md) for the production review and operational checklist.

If `VITE_API_BASE_URL` is not set, the frontend uses the production backend URL configured in `intership-finder/src/config.js`.

## Optional API Keys

The tracker itself does not require external API keys.

Optional paid integrations use user-provided keys:

- `RapidAPI`
  Used for live job search and auto-hunter. The RapidAPI account must have an active JSearch subscription; the Settings validator explains invalid-key, access, quota, and endpoint errors.
- `Gemini`
  Used for cover letters, resume match, follow-up drafts, and company intel

This makes the main product usable without forcing every user through external API setup.

## Repository Notes

- This project is proprietary and not open source.
- The current repo contains the production frontend and backend code used for the tracker.
- Legacy unused frontend files and template assets have been removed as part of cleanup.

## License

This project is proprietary. See [LICENSE](LICENSE).
