# 🚀 Serenity Beauty Clinic - Quick Setup Reference

**TL;DR** - Everything you need to get started in 30 minutes

---

## 📋 Step-by-Step Setup (Copy & Paste)

### Step 1: Database Setup (5 min)

1. Go to https://supabase.com → Sign up → Create new project
2. Name: `serenity-beauty-clinic`
3. Wait for project to initialize
4. **Get your credentials:**
   - Go to Project Settings > API
   - Copy `Project URL` 
   - Copy `anon public` key

### Step 2: Environment File (1 min)

Create `.env.local` in project root:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 3: Run Database Migration (2 min)

1. Go to Supabase Dashboard → SQL Editor → New Query
2. Copy entire contents of `serenity-beauty-clinic-migration.sql`
3. Paste into editor
4. Click **Run** button
5. Wait for "Success" message

**Verify by running:**
```sql
SELECT * FROM clinic;
SELECT * FROM services LIMIT 5;
SELECT * FROM barbers;
```

### Step 4: Create Admin User (3 min)

In Supabase Console:

1. Go to Authentication → Users → Add User
2. Email: `admin@serenitybeauty.com` (use your email)
3. Password: Create strong password
4. Click **Create User**

Then run this SQL:

```sql
-- Get the ids you need:
SELECT id FROM clinic;
SELECT id FROM auth.users WHERE email = 'admin@serenitybeauty.com';

-- Insert admin link (replace xxx with actual ids):
INSERT INTO admin_auth (auth_user_id, clinic_id, role)
VALUES ('YOUR_AUTH_USER_ID', 'YOUR_CLINIC_ID', 'admin');
```

### Step 5: Local Development (5 min)

```bash
# Navigate to project
cd serenity-beauty-clinic

# Install dependencies
npm install

# Start development server
npm run dev

# Open browser: http://localhost:5173
# Login with: admin@serenitybeauty.com / your_password
```

---

## 🌐 Deploy to Vercel (10 min)

### Prerequisites
- GitHub account
- Vercel account
- Project pushed to GitHub

### Steps

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Serenity Beauty Clinic v1.0.0"
   git remote add origin https://github.com/YOUR_USERNAME/serenity-beauty-clinic.git
   git branch -M main
   git push -u origin main
   ```

2. **Import on Vercel:**
   - Go to https://vercel.com/import
   - Select GitHub repository
   - Click Import

3. **Add Environment Variables:**
   - Environment Variables section
   - Add `VITE_SUPABASE_URL` = your Project URL
   - Add `VITE_SUPABASE_ANON_KEY` = your anon key
   - Select "Production" environment
   - Save

4. **Deploy:**
   - Click Deploy button
   - Wait for build (2-3 minutes)
   - Get your live URL! 🎉

5. **Update Supabase Auth:**
   - Go to Supabase → Authentication → URL Configuration
   - Add Redirect URLs:
     - `https://YOUR_VERCEL_URL/`
     - `https://YOUR_VERCEL_URL/dashboard`

---

## 🔐 Important Notes

### ✅ DO THIS
- ✅ Use strong password for admin user
- ✅ Keep `.env.local` file in `.gitignore`
- ✅ Enable Supabase backups
- ✅ Test locally before deploying
- ✅ Change clinic name in Settings after login

### ❌ DON'T DO THIS
- ❌ Commit `.env.local` to GitHub
- ❌ Share your Supabase keys
- ❌ Delete the admin_auth table
- ❌ Use test password in production
- ❌ Skip database migration

---

## 🧪 Test the System

After login, verify everything works:

1. **Dashboard** - Should load with empty stats
2. **POS** - Add a test service & transaction
3. **Services** - Should show 8 pre-populated services
4. **Beauty Specialists** - Should show 4 specialists
5. **Bookings** - Create a test booking
6. **Queue** - Should display queue info
7. **Settings** - Update clinic name

---

## 🆘 Troubleshooting

### "Cannot connect to database"
**Solution:** Check `.env.local` has correct URL and key

### "Login fails"
**Solution:** 
```sql
SELECT * FROM admin_auth;
-- Should show your auth_user_id linked to clinic_id
```

### "Services not loading"
**Solution:**
```sql
SELECT COUNT(*) FROM services;
-- Should return 8
```

### "Build fails on Vercel"
**Solution:**
1. Run locally: `npm run build`
2. Check for errors
3. Push fix to GitHub
4. Vercel will auto-rebuild

---

## 📞 Support

| Issue | Check |
|-------|-------|
| Database errors | Supabase dashboard > SQL Editor |
| Auth errors | Supabase > Authentication > Users |
| Build errors | Run `npm run build` locally |
| Deployment issues | Check Vercel build logs |

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `serenity-beauty-clinic-migration.sql` | Database schema |
| `.env.local` | Environment configuration |
| `SERENITY_DEPLOYMENT_GUIDE.md` | Detailed setup |
| `SERENITY_BEAUTY_README.md` | Feature overview |

---

## ⏱️ Timeline

| Step | Time | Status |
|------|------|--------|
| Create Supabase project | 3 min | ⏳ |
| Environment setup | 1 min | ⏳ |
| Run database migration | 2 min | ⏳ |
| Create admin user | 3 min | ⏳ |
| Test locally | 5 min | ⏳ |
| Deploy to Vercel | 10 min | ⏳ |
| Final verification | 5 min | ⏳ |
| **TOTAL** | **~30 min** | ✅ |

---

## 🎉 Success Checklist

- [ ] `.env.local` created with Supabase credentials
- [ ] Database migration executed successfully
- [ ] Admin user created in Supabase Auth
- [ ] Admin link created in admin_auth table
- [ ] Local development working (`npm run dev`)
- [ ] Login successful with admin credentials
- [ ] All pages accessible and loading
- [ ] GitHub repository created with code pushed
- [ ] Vercel project imported and environment variables added
- [ ] Live deployment successful
- [ ] Can login to production site
- [ ] Clinic ready for use! 🌸

---

## 🚀 You're Ready!

Follow these 5 steps and you'll be live:

1. Create Supabase project, run migration, create admin user
2. Test locally: `npm run dev`
3. Push to GitHub
4. Import on Vercel
5. Add env variables & deploy

**That's it!** Your Serenity Beauty Clinic is ready to manage your business.

---

**Questions?** See SERENITY_DEPLOYMENT_GUIDE.md for detailed instructions.

🌸 **Welcome to Serenity!** 🌸

*v1.0.0 - March 25, 2026*
