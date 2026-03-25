# 💅 Serenity Beauty Clinic - Setup & Deployment Guide

**Version:** 1.0.0  
**Theme:** Women-focused Beauty Services  
**Architecture:** Single Admin (No SaaS)

---

## 📋 Quick Setup Checklist

### Phase 1: Supabase Database Setup (10 minutes)

#### Step 1: Create Supabase Project
1. Go to https://supabase.com and create a new project
2. Save your **Project URL** and **Anon Key** (you'll need these)
3. Go to SQL Editor

#### Step 2: Run Database Migration
1. Open `serenity_beauty_clinic_database.sql` from this repository
2. Copy the entire SQL content
3. Paste into Supabase SQL Editor
4. Click **Run** (⏱️ Takes ~2-3 minutes)
5. ✅ Verify: You should see "SETUP COMPLETE" message at the bottom

**What gets created:**
- 9 tables (therapists, clients, services, bookings, etc.)
- Row-Level Security (RLS) policies for single admin
- 50+ beauty services (pre-seeded)
- 5 sample therapists
- 3 sample clients
- Default settings

---

### Phase 2: Supabase Authentication Setup (5 minutes)

#### Step 1: Create Admin User
1. In Supabase Console, go to **Authentication > Users**
2. Click **Add User** (top right)
3. Enter:
   - **Email:** your_email@example.com
   - **Password:** (strong password, e.g., `Secure@Password123`)
4. Click **Create User**
5. ✅ Copy the **User ID** (UUID format)

#### Step 2: Link Admin to Clinic
1. Go to **SQL Editor** in Supabase
2. Run this query:
```sql
INSERT INTO admin_auth (auth_user_id, clinic_id, email)
VALUES ('PASTE_YOUR_USER_ID_HERE', gen_random_uuid(), 'your_email@example.com');
```
3. Replace `PASTE_YOUR_USER_ID_HERE` with your copied User ID

**Example:**
```sql
INSERT INTO admin_auth (auth_user_id, clinic_id, email)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', gen_random_uuid(), 'admin@serenity.com');
```

---

### Phase 3: React App Setup (10 minutes)

#### Step 1: Environment Variables
1. In your project root, create `.env.local` file
2. Add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...YOUR_ANON_KEY
```

**Where to find these:**
- Supabase Console > Settings > API
- Copy **Project URL** and **anon public** key

#### Step 2: Install Dependencies
```bash
npm install
```

#### Step 3: Run Development Server
```bash
npm run dev
```

- App opens at: http://localhost:5174
- Login page appears
- Enter your admin email and password

---

## 🎨 Customization Guide

### Brand Colors (Pink & Women Theme)
All colors are defined in `tailwind.config.js`:

```javascript
{
  'rose-pink': '#E91E63',      // Primary Button
  'deep-pink': '#C2185B',      // Deep Accents
  'light-pink': '#F06292',     // Hover States
  'soft-purple': '#CE93D8',    // Secondary
  'magenta': '#D946EF',        // Highlights
  'blush': '#FBE9E7',          // Light Backgrounds
}
```

**To change colors globally:**
1. Edit `src/tailwind.config.js`
2. Update color values
3. Colors automatically update across all pages

---

### Update Clinic Name & Settings
1. Login to admin dashboard
2. Go to **Settings** page
3. Update:
   - Clinic Name
   - Clinic Phone
   - Clinic Email
   - Working Hours
   - Currency

Or modify in database:
```sql
UPDATE settings SET value = '"Your Clinic Name"' WHERE key = 'clinic_name';
UPDATE settings SET value = '"01000000000"' WHERE key = 'clinic_phone';
```

---

### Add/Edit Services
#### Via Admin Dashboard:
1. Go to **Services** page
2. Click **Add Service**
3. Fill in:
   - Name (Arabic & English)
   - Price
   - Duration (minutes)
   - Category (skincare, hair, nails, etc.)

#### Seed Additional Services:
```sql
INSERT INTO services (name_ar, name_en, price, duration, category, active) VALUES
('اسم الخدمة بالعربية', 'Service Name in English', 200.00, 45, 'skincare', true);
```

---

### Add/Edit Therapists
1. Go to **Therapists/Staff** page
2. Click **Add Therapist**
3. Fill in:
   - Name
   - Phone
   - Specialization
   - Bio

---

## 🚀 Deployment

### Deploy to Vercel

1. **Push to GitHub:**
```bash
git add .
git commit -m "Initial Serenity Beauty Clinic setup"
git push origin main
```

2. **Connect to Vercel:**
   - Go to https://vercel.com
   - Click "New Project"
   - Select your GitHub repository
   - Click "Import"

3. **Add Environment Variables in Vercel:**
   - Go to Settings > Environment Variables
   - Add:
     - `VITE_SUPABASE_URL`: Your Supabase URL
     - `VITE_SUPABASE_ANON_KEY`: Your Anon Key
   - Click "Save"

4. **Deploy:**
   - Click "Deploy"
   - ✅ Your site is live!

---

### Custom Domain (Optional)
1. In Vercel > Settings > Domains
2. Add your custom domain
3. Follow DNS setup instructions
4. ✅ Your custom domain is connected

---

## 🔐 Security Best Practices

### Environment Variables
- ✅ Always use `.env.local` locally
- ✅ Never commit `.env.local` to GitHub
- ✅ Use Vercel environment variables for production
- ✅ Never share your Anon Key in public

### Database
- ✅ RLS policies are already configured
- ✅ Single admin has full access
- ✅ Clients cannot modify other clients' data
- ✅ No unauthorized access possible

### Passwords
- ✅ Use strong passwords (12+ characters, mix of types)
- ✅ Enable 2FA if available in Supabase
- ✅ Regularly review Supabase audit logs

---

## 📊 Key Features Available

✅ **Dashboard** - KPIs, revenue, client metrics  
✅ **POS (Point of Sale)** - Checkout, receipts, payments  
✅ **Bookings** - Smart therapist assignment, wait times  
✅ **Queue Management** - Real-time queue display  
✅ **Clients** - Client database, history, VIP status  
✅ **Services** - Service catalog, pricing, categories  
✅ **Therapists** - Staff management, specializations  
✅ **Analytics** - Revenue, expenses, profit reports  
✅ **Settings** - Clinic info, hours, preferences  
✅ **Multi-language** - Arabic (RTL) + English  

---

## 🆘 Troubleshooting

### "Login fails with email/password"
**Solution:**
1. Check email matches exactly in Supabase > Auth > Users
2. Verify user was created in Supabase (not just created locally)
3. Verify `admin_auth` record exists with matching auth_user_id

**Debug query:**
```sql
SELECT * FROM admin_auth WHERE email = 'your_email@example.com';
```

### "Page shows 'Loading...'" for 5+ seconds
**Solution:**
1. Check Supabase URL is correct in `.env.local`
2. Check Anon Key is correct
3. Verify Supabase project is not paused
4. Check browser console for errors (F12 > Console)

### "Services not showing on bookings page"
**Solution:**
1. Verify services are created: `SELECT * FROM services;`
2. Verify services have `active = true`
3. Hard refresh page (Ctrl+Shift+R)

### "Can't add clients"
**Solution:**
1. Check phone number is unique (no duplicates)
2. Verify phone format is valid
3. Check RLS policy allows admin to insert

---

## 📞 Support

For issues:
1. Check browser console (F12)
2. Check Supabase logs (Supabase Console > Logs)
3. Verify all `.env` variables are correct
4. Test with sample data provided

---

## 📦 Project Structure

```
serenity-clinic/
├── src/
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── POS.tsx
│   │   ├── Bookings.tsx
│   │   ├── Services.tsx
│   │   ├── Therapists.tsx
│   │   ├── Clients.tsx
│   │   ├── Analytics.tsx
│   │   ├── Settings.tsx
│   │   └── Login.tsx
│   ├── components/
│   │   ├── layout/
│   │   ├── ui/
│   │   └── ...
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useTheme.ts
│   │   └── ...
│   ├── db/
│   │   └── supabase.ts
│   └── App.tsx
├── .env.local (CREATE THIS)
├── package.json
├── tailwind.config.js
└── serenity_beauty_clinic_database.sql
```

---

## ✅ Success Checklist

- [ ] Supabase project created
- [ ] Database migration executed successfully
- [ ] Admin user created in Supabase Auth
- [ ] Admin linked in admin_auth table
- [ ] `.env.local` created with Supabase credentials
- [ ] `npm install` completed
- [ ] `npm run dev` runs without errors
- [ ] Can login with admin email/password
- [ ] Dashboard loads and shows data
- [ ] Can create new clients
- [ ] Can create new bookings
- [ ] Services are visible in bookings
- [ ] Ready to deploy to Vercel

---

**You're all set! 💅✨**
