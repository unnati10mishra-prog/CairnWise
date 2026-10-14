# Cairnwise Supabase Integration Guide

Cairnwise uses **Supabase** for enterprise-grade authentication, role-based access control (RBAC), and persistent audit trails.

---

## 1. Quick Setup (2 Minutes)

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **Project Settings** &rarr; **API**.
3. Copy:
   - **Project URL**
   - **Project API Anon Key**
4. In the `web` folder, create `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
5. Restart or start the Next.js server (`npm run dev`).

> **Zero-Configuration Fallback:** If the environment variables are not set, Cairnwise activates its built-in interactive preview session. You can test all login, signup, role-switching, and workspace workflows out-of-the-box!

---

## 2. Enabling Google OAuth (Optional)

1. In Supabase Dashboard, navigate to **Authentication** &rarr; **Providers** &rarr; **Google**.
2. Toggle Google **Enabled**.
3. Add your Google OAuth Client ID and Secret (from Google Cloud Console).
4. Set the Callback URL provided by Supabase in your Google Cloud Console Authorized Redirect URIs.

---

## 3. Recommended Postgres Schema (Optional for Profiles & Audit)

Run the following SQL in your Supabase SQL Editor if you want to store operator profiles and immutable review signatures:

```sql
-- 1. Create operator profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  organization text,
  role text default 'analyst' check (role in ('analyst', 'reviewer', 'lead')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- 3. RLS Policies
create policy "Public profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- 4. Trigger to automatically provision profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, organization, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'organization',
    coalesce(new.raw_user_meta_data->>'role', 'analyst')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```
