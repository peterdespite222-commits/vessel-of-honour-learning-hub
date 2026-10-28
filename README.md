# Vessel of Honour Learning Hub — Cloud version

This version uses HTML, CSS and JavaScript with Supabase Auth + PostgreSQL. Posts are stored online and shared between signed-in users on different devices.

## Setup — 4 short steps

### 1. Create the Supabase project
1. Open https://supabase.com and create a project.
2. In the project dashboard, open **SQL Editor** → **New query**.
3. Open `supabase.sql` from this folder, copy all of it into the SQL Editor, then click **Run**.

### 2. Add the project keys
1. In Supabase, open **Project Settings** → **API** (or **Connect**, depending on the dashboard layout).
2. Copy the **Project URL** and the **anon/public key** (sometimes labelled publishable key).
3. Open `config.js` in VS Code and replace the two placeholder strings.
4. Never use the `service_role` or secret key in browser JavaScript.

### 3. Run the app
Open `index.html` in your browser or use VS Code's Live Server extension. For testing, use Live Server rather than opening the file directly. Sign up with an email and password, then confirm your email if Supabase asks you to.

### 4. Approve teacher accounts
Every new signup is deliberately a **student**. To make a trusted account a teacher:
1. Sign up using that teacher's email and confirm it.
2. In Supabase **SQL Editor**, run the following, replacing the email with the exact teacher email:

```sql
update public.profiles p
set role = 'teacher'
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('teacher@example.com');
```

Run this only as the school project owner for staff you have verified. The teacher should sign out and sign in again. Students cannot grant themselves teacher access.

## What this version does
- Secure email/password authentication through Supabase.
- All signed-in students and teachers can read the same school posts.
- Only approved teacher accounts can create or delete posts, enforced by database Row Level Security (RLS).
- Responsive dashboard for phone and computer.

## Important notes
- This starter shares posts, not file attachments or student submissions yet.
- Configure Supabase Auth email confirmation and password recovery appropriately before school launch.
- For a real school rollout, use verified school accounts, establish a process to approve teachers, review privacy/consent obligations, and test RLS policies before adding real student information.
- Static HTML is fine for a prototype, but publish over HTTPS. Never commit passwords, service-role keys, or other server secrets to GitHub.
