# FLEX GAMES PREDICTION — Backend

Node.js / Express API for the FLEX GAMES PREDICTION platform. The public website and admin dashboard are intended to be deployed as separate GitHub Pages sites. This repository is the API service deployed to Render.

## Runtime
- Node.js 20+
- PostgreSQL
- Express sessions stored in PostgreSQL
- Resend API for password-recovery emails

## Local setup
1. Install Node.js 20 or newer and PostgreSQL.
2. Clone this repository and run `npm install`.
3. Create a database and run `database.sql` for a new database.
4. Copy `.env.example` to `.env` and fill in the values.
5. Run `npm run create:superadmin` once to create/promote the initial super-admin.
6. Run `npm start`.

For an existing database, back it up first and run `migrations/001_auth_compatibility.sql` instead of re-running the full bootstrap schema. Review the migration before applying it to a production database.

## Render environment variables
Set these in the Render service dashboard:
- `NODE_ENV=production`
- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — long random secret (at least 32 random bytes)
- `FRONTEND_ORIGINS` — comma-separated exact origins for the public and admin GitHub Pages sites; no trailing slash
- `PUBLIC_APP_URL` — public website base URL, used in password-reset links
- `RESEND_API_KEY` — Resend API key
- `RESEND_FROM_EMAIL` — verified sender, e.g. a sender on your verified Resend domain
- `ADMIN_EMAIL`, `ADMIN_PHONE`, `ADMIN_PASSWORD`, optionally `ADMIN_NAME` — bootstrap account values

After deployment, run `npm run create:superadmin` in a Render shell or a trusted one-off environment. Do not put the admin password in source control.

## Frontend API URL
The static frontend reads `window.FLEX_API_URL` from `public/config.js`. Set it to the Render API origin, for example `https://your-service.onrender.com` (no trailing slash), when configuring the public website deployment. The admin site must use the same API origin and send requests with credentials.

## API routes
- `GET /api/health`
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/admin/login`
- `GET /api/auth/me`, `POST /api/auth/logout`
- `POST /api/auth/password/forgot`, `POST /api/auth/password/reset`
- `POST /api/otp/request`, `POST /api/otp/verify`
- `GET /api/admin/overview`, `GET /api/admin/users`

## Important deployment notes
- Cross-site session cookies require HTTPS on both GitHub Pages and Render; the API uses secure, SameSite=None cookies in production.
- Add the exact public and admin site origins to `FRONTEND_ORIGINS`.
- Phone OTP currently works only in development and displays the code for local testing. Production SMS delivery is deliberately disabled until an SMS provider is configured.
- Never commit `.env`, API keys, database credentials, or real user data.
