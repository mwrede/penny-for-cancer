# A Penny For Cancer — Production Setup Guide

This guide walks you through the one-time setup needed before your deployed site actually works. Plan on **~15 minutes**.

The app needs three external services:
1. **Supabase** — login + database (free tier is plenty)
2. **Cloudflare Turnstile** — CAPTCHA on the login form (free)
3. **Vercel** — hosting (you already have this)

---

## 1. Supabase

### 1a. Create the project

1. Go to https://supabase.com → sign in → **New project**
2. Name it `penny-for-cancer`, pick a region close to you, set a strong DB password, hit **Create**. Wait ~2 min for provisioning.

### 1b. Run the database migration

Dashboard → **SQL Editor** → **New query** → paste this and click **Run**:

```sql
create table public.moles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  date date not null default current_date,
  notes text,
  measurements jsonb,
  classification jsonb,
  avatar_config jsonb,
  abc_analysis jsonb,
  crop_image text,
  created_at timestamptz default now()
);

alter table public.moles enable row level security;

create policy "own records" on public.moles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.api_usage (
  user_id uuid references auth.users(id) on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);
```

### 1c. Configure auth for magic link

1. Dashboard → **Authentication** → **Providers** → **Email** is already on. Toggle off "Confirm email" only if you want signup to be instant (otherwise new users have to click the confirmation link, which is fine).
2. Dashboard → **Authentication** → **Email Templates** → **Magic Link** → change the subject to something friendly like:
   ```
   Your A Penny For Cancer sign-in link
   ```
3. Dashboard → **Authentication** → **URL Configuration** → add these to **Redirect URLs**:
   - `http://localhost:5173`
   - `https://penny-for-cancer.vercel.app`
   - `https://penny-for-cancer.vercel.app/**`

### 1d. Grab your keys

Dashboard → **Project Settings** → **API**. Copy three values — you'll paste them into Vercel next:

- **Project URL** → goes into `VITE_SUPABASE_URL` **and** `SUPABASE_URL`
- **anon public** key → goes into `VITE_SUPABASE_ANON_KEY`
- **service_role** key (scroll down, click reveal) → goes into `SUPABASE_SERVICE_ROLE_KEY` — **never expose this to the client**

---

## 2. Cloudflare Turnstile (CAPTCHA)

1. Go to https://dash.cloudflare.com → Turnstile → **Add site**
2. Name: `penny-for-cancer`. Add hostnames: `penny-for-cancer.vercel.app` and `localhost`. Widget mode: **Managed** (Cloudflare picks invisible/checkbox automatically).
3. Copy the **Site key** and **Secret key**.

### Plug Turnstile into Supabase

Supabase Dashboard → **Authentication** → **Settings** → scroll to **Bot and Abuse Protection** → toggle **Enable CAPTCHA protection**, pick **Turnstile**, paste the **Secret key**. Save.

---

## 3. Vercel environment variables

Vercel Dashboard → your project → **Settings** → **Environment Variables**. Add these (all environments: Production, Preview, Development):

| Name | Value | Scope |
|------|-------|-------|
| `VITE_SUPABASE_URL` | Supabase Project URL | public (embedded in bundle) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | public |
| `VITE_TURNSTILE_SITE_KEY` | Turnstile Site key | public |
| `SUPABASE_URL` | Supabase Project URL | server |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key | server — **keep secret** |
| `ROBOFLOW_API_KEY` | `jIlsPhHeCYPv0LCOooQT` (the key currently in use) | server — **keep secret** |

After adding them, redeploy from the Deployments tab so the new vars take effect.

### Rotate the Roboflow key

The current key is in git history as a string literal. Once the env var is live and verified working on the deployed site:

1. Go to https://app.roboflow.com → Settings → API keys → rotate the key.
2. Update `ROBOFLOW_API_KEY` in Vercel with the new value.
3. Redeploy.

---

## 4. Local development

Create `frontend/.env.local` (git-ignored) with the three `VITE_*` values:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_TURNSTILE_SITE_KEY=0x4AAA...
```

The Edge function (`/api/rf`) doesn't run under `vite dev` — it only works on Vercel. That means in local dev you can sign in and save/load data, but the "Detect Penny" button will 404 locally. That's fine — test Roboflow on the deployed site.

---

## 5. Verify it works

Deployed site:

1. Visit https://penny-for-cancer.vercel.app → Login screen loads (not bypassed).
2. Enter your email → pass Turnstile → check inbox → click magic link → land signed in.
3. Upload a photo with a penny → label it → Detect. Results appear.
4. Save the record. Refresh the browser — still signed in, record still there.
5. Sign out → sign in with a different email → empty list (data isolated per user).
6. Try 21 detections in a row — the 21st returns a friendly "daily limit reached" message.

---

## 6. Adding LinkedIn OAuth later (optional)

When you're ready:

1. Create a LinkedIn app at https://www.linkedin.com/developers/apps
2. Supabase Dashboard → Authentication → Providers → LinkedIn (OIDC) → paste Client ID + Secret.
3. Add a "Continue with LinkedIn" button to `Login.jsx` that calls:
   ```js
   supabase.auth.signInWithOAuth({ provider: 'linkedin_oidc' })
   ```

No schema changes needed — Supabase merges identities by email.
