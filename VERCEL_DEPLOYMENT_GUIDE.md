# 🌸 Serenity Beauty Clinic - Vercel Deployment Guide

## ✅ Pre-Deployment Checklist

- [x] Build successful (✓ 2857 modules transformed)
- [x] Code compiled without errors
- [x] Database migration SQL ready
- [x] All dependencies installed
- [ ] Supabase project created
- [ ] Database schema imported
- [ ] Environment variables configured
- [ ] GitHub repository synced

---

## 📋 Step 1: Supabase Database Setup

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Sign up/Log in
3. Click "New Project"
4. Choose project name: `serenity-beauty-clinic`
5. Create secure password
6. Choose region closest to users
7. Click "Create new project"

### 1.2 Get Supabase Credentials
After project creation:
1. Go to **Settings → API**
2. Copy the following:
   - **Project URL** → Save as `VITE_SUPABASE_URL`
   - **Anon Key** (public) → Save as `VITE_SUPABASE_ANON_KEY`

### 1.3 Run Database Migration
1. In Supabase, go to **SQL Editor**
2. Click "New Query"
3. Open file: `serenity-beauty-clinic-migration.sql`
4. Copy entire SQL content
5. Paste into Supabase SQL Editor
6. Click "Run"
7. Wait for completion (should see GREEN checkmark)

**Result:** Database tables created with:
- `clinic` (1 pre-populated clinic)
- `admin_auth` (admin authentication)
- `services` (8 beauty services)
- `specialists` (4 beauty specialists)
- `clients`, `bookings`, `transactions`, etc.

---

## 🌐 Step 2: Vercel Deployment

### 2.1 Connect GitHub Repository
1. Go to [vercel.com](https://vercel.com)
2. Sign in (create account if needed)
3. Click "Add New → Project"
4. Click "Import Git Repository"
5. Select: `serenity0serenity0-stack/SerenityBeautyClinic`
6. Click "Import"

### 2.2 Configure Environment Variables
In Vercel Project Settings:
1. Click **Settings → Environment Variables**
2. Add three variables:

```
VITE_SUPABASE_URL=<your_supabase_url>
VITE_SUPABASE_ANON_KEY=<your_anon_key>
VITE_API_URL=<deployment_url>/api
```

**Example:**
```
VITE_SUPABASE_URL=https://abcdefg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
VITE_API_URL=https://serenity-clinic.vercel.app/api
```

### 2.3 Deploy
1. Click "Deploy"
2. Wait for build completion (5-10 minutes)
3. Click "Visit" to see live site

**Your app is now live at:** `https://<your-project>.vercel.app`

---

## 🔐 Step 3: Admin Account Setup

### 3.1 Create Supabase Auth User
In Supabase:
1. Go to **Authentication → Users**
2. Click "Add user"
3. Email: `admin@serenity-clinic.com`
4. Password: `YourSecurePassword123!`
5. Click "Create user"

### 3.2 Create Admin Record
In Supabase SQL Editor, run:
```sql
INSERT INTO admin_auth (email, auth_user_id, clinic_id)
VALUES (
  'admin@serenity-clinic.com',
  '<user_id_from_auth>',
  'clinic-001'
);
```

### 3.3 First Login
1. Go to your Vercel deployment URL
2. Click "Login"
3. Email: `admin@serenity-clinic.com`
4. Password: `YourSecurePassword123!`
5. Click "Sign In"

✅ You're logged in!

---

## 🛠️ Troubleshooting

### "Database Connection Failed"
- [ ] Verify `VITE_SUPABASE_URL` is correct
- [ ] Check `VITE_SUPABASE_ANON_KEY` is not expired
- [ ] Ensure Supabase project is active

### "Invalid Credentials"
- [ ] Admin email must match Supabase auth user
- [ ] Password must be set in Supabase
- [ ] Ensure `admin_auth` table has matching record

### "Build Failed"
- [ ] Check GitHub repository has latest code
- [ ] Verify Node.js 18+ is available
- [ ] Check environment variables are set

### "Blank Page"
- [ ] Open browser DevTools (F12)
- [ ] Check Console for error messages
- [ ] Verify `.env.local` contains valid credentials

---

## 📱 Post-Deployment

### Configure Application Settings
1. Login as admin
2. Go to **Settings → Clinic Settings**
3. Update:
   - Clinic Name
   - Phone Number
   - Address
   - Logo/Branding
4. Save changes

### Add Specialists ✂️
1. Go to **Barbers/Specialists**
2. Click "Add Specialist"
3. Fill form:
   - Name
   - Phone
   - Specialization
4. Save

### Add Services 💇
1. Go to **Services**
2. Click "Add Service"
3. Fill form:
   - Service Name
   - Category (Hair, Nails, Makeup, Skincare)
   - Price
   - Duration
4. Save

---

## 🚀 Performance Monitoring

### Vercel Analytics
1. Project → Analytics
2. Monitor:
   - Page Load Time
   - Core Web Vitals
   - Error Rate

### Supabase Monitoring
1. Go to **Database → Logs**
2. Check for:
   - Query errors
   - Rate limits
   - Performance issues

---

## 📊 Database Backup

### Daily Backups (Automatic)
Supabase includes automatic daily backups. To restore:
1. Go to **Settings → Database → Backups**
2. Click restore icon next to backup date
3. Confirm restoration

### Manual Export
```sql
-- Export all tables
pg_dump -U postgres -h <host> -d postgres > backup.sql
```

---

## 🔄 Future Updates

### Deploy New Code
```bash
# Push to GitHub
git add .
git commit -m "Update features"
git push origin main
```

Vercel automatically deploys on push to `main` branch!

### Run Migrations
```bash
# Login to Supabase
# Go to SQL Editor
# Paste migration SQL
# Click Run
```

---

## 📞 Support

**Common Issues:**
- Database: Check Supabase API status
- Deployment: Check Vercel build logs
- Code: Review GitHub for latest commits

**Documentation:**
- [Vercel Docs](https://vercel.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [React Docs](https://react.dev)

---

## ✅ Deployment Verification Checklist

- [ ] Supabase project created and accessible
- [ ] Database migration SQL executed successfully
- [ ] Admin auth user created in Supabase
- [ ] Environment variables set in Vercel
- [ ] GitHub repository connected to Vercel
- [ ] First deployment completed (green checkmark)
- [ ] Application loads in browser
- [ ] Admin login successful
- [ ] Dashboard displays correctly
- [ ] Services and Specialists visible

**Status: 🌸 PRODUCTION READY**

---

*Last Updated: March 25, 2026*
