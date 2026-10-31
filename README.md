# College Late Comers Management System

A web application for **Don Bosco College of Arts and Science** to replace the paper-based late-comers register. Authorised college staff record student late arrivals, view the register, detect repeat late comers, track parent/guardian communication, and generate reports.

## Tech Stack

- **Frontend:** React (Vite), React Router, Bootstrap 5, Chart.js
- **Backend:** Python Flask (JSON API under `/api`), SQLAlchemy, Pydantic
- **Database:** Supabase (hosted Postgres)
- **Auth:** Google Sign-In via Authlib
- **Deployment:** Vercel (single project)

## Setup

### Prerequisites
- Node.js 18+
- Python 3.11+
- Supabase project with the schema applied

### 1. Clone and configure
```bash
cp .env.example .env
# Fill in all values in .env
```

### 2. Database
Run `schema.sql` in your Supabase SQL Editor to create all tables.

### 3. Backend
```bash
pip install -r requirements.txt
```

### 4. Frontend
```bash
cd frontend
npm install
```

### 5. Development
```bash
# Terminal 1 — Flask API
cd backend && flask --app index run --port 5000

# Terminal 2 — React dev server (proxies /api to Flask)
cd frontend && npm run dev
```

## Environment Variables

See `.env.example` for all required variables. **Never commit `.env`.**

| Variable | Where | Description |
|---|---|---|
| `DATABASE_URL` | Server | Supabase Postgres connection (port 6543, transaction pooler) |
| `FLASK_SECRET_KEY` | Server | Random secret for Flask sessions |
| `GOOGLE_CLIENT_ID` | Server + Client | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | Server | Google OAuth2 client secret |
| `ALLOWED_EMAIL_DOMAIN` | Server | Optional: restrict login to a specific domain |
| `VITE_API_BASE_URL` | Client (public) | API base URL (default: `/api`) |
| `VITE_GOOGLE_CLIENT_ID` | Client (public) | Google client ID for frontend |

## Security Notes

- All API routes require authentication; admin routes require admin role
- Session tokens are hashed (SHA-256) before storage
- Cookies are `HttpOnly`, `Secure`, `SameSite=Lax`
- CSRF protection via `X-CSRF-Token` header on state-changing requests
- Excel/CSV exports neutralise formula injection
- No `dangerouslySetInnerHTML` usage
- RLS enabled on all Supabase tables (no policies; backend connects directly)
- Rate limiting on login, search, and export endpoints

## Deployment Guide

### 1. Supabase (Database Setup)

1. Create a free account at [Supabase](https://supabase.com) and create a new project.
2. In the Supabase Dashboard, navigate to **SQL Editor**.
3. Open [`schema.sql`](./schema.sql), copy its entire content, paste it into the SQL editor, and click **Run**. This creates:
   - All core tables (`departments`, `users`, `students`, `late_arrivals`, `settings`, `audit_log`, `sessions`, `parent_communications`, `rate_limits`)
   - Default settings record
   - Timestamps triggers and performance indexes
   - Row-Level Security (RLS) policies
4. Create your initial admin user in the SQL Editor:
   ```sql
   INSERT INTO users (email, name, role) 
   VALUES ('your-google-email@domain.com', 'Admin Name', 'admin');
   ```
5. Get your database connection string:
   - Go to **Project Settings** > **Database** > **Connection Pooling**.
   - Select **Mode: Transaction** (port `6543`) or **Session** (port `5432`).
   - Copy the URI string format:
     ```text
     postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
     ```

---

### 2. Vercel (Recommended Full-Stack Deployment)

Vercel hosts both the React frontend and the Python Flask backend serverless functions together as a single unified deployment:

1. Push this repository to GitHub or GitLab.
2. Log in to [Vercel](https://vercel.com) and click **Add New** > **Project**.
3. Select your repository.
4. Settings:
   - **Framework Preset:** Other / None
   - **Root Directory:** `./`
   - **Build Command:** `cd frontend && npm install && npm run build` (configured automatically via [`vercel.json`](./vercel.json))
   - **Output Directory:** `frontend/dist`
5. Add the following **Environment Variables** in the Vercel dashboard:
   - `DATABASE_URL`: Your Supabase transaction pooler URI
   - `FLASK_SECRET_KEY`: A secure 64-char random string (generate with `python -c "import secrets; print(secrets.token_urlsafe(64))"`)
   - `GOOGLE_CLIENT_ID`: Google OAuth 2.0 Web Client ID
   - `GOOGLE_CLIENT_SECRET`: Google OAuth 2.0 Client Secret
   - `ALLOWED_EMAIL_DOMAIN`: (Optional) e.g., `donboscocollege.edu.in`
   - `VITE_API_BASE_URL`: `/api`
   - `VITE_GOOGLE_CLIENT_ID`: Same Google OAuth Client ID
6. In **Google Cloud Console** > **Credentials** > **Authorized redirect URIs**, add:
   - `https://<your-vercel-app>.vercel.app/api/auth/google/callback`
7. Click **Deploy**. Vercel will build the React SPA and deploy the Flask API functions.

---

### 3. Netlify (Alternative Frontend Deployment)

If you prefer hosting the React frontend on Netlify while running the backend on Vercel:

1. Push your repository to GitHub.
2. In [Netlify](https://netlify.com), click **Add new site** > **Import an existing project**.
3. Select the repository. Netlify detects [`netlify.toml`](./netlify.toml):
   - **Base directory:** `frontend`
   - **Build command:** `npm install && npm run build`
   - **Publish directory:** `dist`
4. Set **Environment Variables** in Netlify (**Site configuration** > **Environment variables**):
   - `VITE_API_BASE_URL`: `https://<your-backend-vercel-url>.vercel.app/api`
   - `VITE_GOOGLE_CLIENT_ID`: Your Google OAuth 2.0 Client ID
5. Click **Deploy site**.
6. The included `_redirects` file ensures that all React Router browser routes (e.g., `/dashboard`, `/daily-register`) route correctly without 404 errors on page reload.

---

## Privacy & Data Protection (DPDP Act)

This system processes student personal data, which may include individuals under 18 years of age. The deploying institution (Don Bosco College of Arts and Science) **must**:

1. Confirm compliance with the Digital Personal Data Protection Act, 2023 (DPDP Act)
2. Establish and enforce a data retention policy
3. Obtain necessary consents as required by law
4. Appoint a Data Protection Officer if required
5. Ensure appropriate access controls are in place

The system collects only the fields required for the late-comers register. Guardian phone numbers are masked in list views.

## License

Private — for institutional use only.
