# 💅 Serenity Beauty Clinic - Management System

**Professional Beauty & Wellness Management Platform**  
**Version:** 1.0.0 | **Theme:** Pink & Women-Focused | **Architecture:** Single Admin  

---

## 🌟 Overview

Serenity Beauty Clinic is a modern, production-ready management system specifically designed for beauty and wellness clinics. Built with React, TypeScript, and Supabase, it provides all necessary tools for clinic owners to manage operations efficiently.

### Key Highlights
- ✨ **Women-Themed Design** - Pink & beauty-focused color palette
- 💼 **Single Admin Architecture** - One admin manages everything
- 🎨 **Modern UI** - Glassmorphism design, smooth animations
- 🌍 **Bilingual** - Full Arabic (RTL) + English support
- 📱 **Responsive** - Works on desktop and mobile
- 🔐 **Bank-Grade Security** - Row-Level Security on all tables
- ⚡ **Real-Time Updates** - Instant data synchronization

---

## 🎯 Core Features

### 📊 Dashboard
- KPI Overview (Revenue, Clients, Appointments, etc.)
- Revenue trends and analytics
- Quick actions for common tasks
- Today's schedule overview

### 💄 Services Management
- Add/edit beauty services
- Categories: skincare, hair, nails, massage, etc.
- Bilingual descriptions (Arabic + English)
- Price and duration management
- 50+ pre-seeded beauty service templates

### 👥 Client Management
- Complete client database
- Client history and visit logs
- VIP status tracking
- Birthday reminders
- Contact information management
- Skin type & allergy notes

### 📅 Booking System
- Smart appointment scheduling
- Automatic therapist assignment
- Real-time availability checking
- Queue management
- Booking history
- Cancellation tracking

### 💸 Point of Sale (POS)
- Professional checkout system
- Receipt printing (print-friendly)
- Payment method tracking (Cash, Card, Transfer, etc.)
- Discount management (Fixed or Percentage)
- Transaction history
- VIP bonus points

### 💅 Therapist Management
- Staff information and specializations
- Schedule management
- Performance tracking
- Service assignments
- 5 pre-seeded sample therapists

### 📈 Analytics Dashboard
- Revenue reports
- Client metrics
- Service popularity
- Therapist performance
- Expense tracking
- Profit & loss analysis

### ⚙️ Settings
- Clinic information (name, phone, email)
- Working hours configuration
- Email notifications
- Theme preferences (Dark/Light)
- Language settings (Arabic/English)
- Currency configuration (EGP, USD, etc.)

### 📋 Additional Features
- Daily logs for visit notes
- Expense tracking
- Queue display (for waiting room TVs)
- Report generation
- Data export capabilities

---

## 🛠️ Tech Stack

**Frontend:**
- React 18.2 - UI library
- TypeScript - Type safety
- Vite - Fast build tool
- Tailwind CSS - Styling with custom pink theme
- Framer Motion - Animations
- React Hook Form - Form management
- Zod - Schema validation

**Backend:**
- Supabase (PostgreSQL) - Database & Auth
- PostgreSQL - Powerful relational database
- Row-Level Security - Multi-user data isolation
- Real-time subscriptions - Live data updates

**Development:**
- Vite - Ultra-fast builds (2.8K+ modules in <100ms)
- TypeScript 5.3 - Latest TS features
- Tailwind CSS 3.4 - Utility-first styling

---

## 📋 Database Schema

### Tables
1. **admin_auth** - Single admin authentication
2. **therapists** - Beauty therapists/aestheticians
3. **clients** - Client database
4. **services** - Beauty services catalog
5. **bookings** - Appointment management
6. **transactions** - POS transactions
7. **expenses** - Business expenses
8. **visit_logs** - Client visit notes & history
9. **settings** - Clinic configuration

### Security
- All tables have Row-Level Security (RLS) enabled
- Admin policies: Full CRUD access
- All data isolated per clinic (single clinic architecture)
- Access control through Supabase Auth

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Supabase account (free at https://supabase.com)
- Git (optional, for version control)

### Step 1: Clone/Download Project
```bash
cd your-projects-folder
git clone <your-repo-url> serenity-clinic
cd serenity-clinic
```

### Step 2: Set Up Supabase Database
1. Create Supabase project at https://supabase.com
2. Open `serenity_beauty_clinic_database.sql`
3. Copy all SQL code
4. Paste into Supabase SQL Editor and execute
5. **DONE!** All tables, data, and policies are set up

### Step 3: Create Admin User
1. Go to Supabase Console > Authentication > Users
2. Click "Add User" button
3. Email: your_email@beautyclinic.com
4. Password: (strong password)
5. Click "Create User"
6. Copy the User ID (UUID)

### Step 4: Link Admin to Clinic
In Supabase SQL Editor, run:
```sql
INSERT INTO admin_auth (auth_user_id, clinic_id, email)
VALUES ('YOUR_USER_ID_HERE', gen_random_uuid(), 'your_email@beautyclinic.com');
```

Replace `YOUR_USER_ID_HERE` with the copied User ID.

### Step 5: Setup Local Environment
```bash
# Install dependencies
npm install

# Create .env.local file
# Add these exactly as from Supabase Settings > API:
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY_HERE

# Start development server
npm run dev
```

Server runs at: http://localhost:5174

### Step 6: Login
- Email: your_email@beautyclub.com (the one you created)
- Password: (the password you set)
- Dashboard loads automatically ✅

---

## 🎨 Customization

### Change Clinic Name
1. Login to dashboard
2. Go to Settings
3. Update "Clinic Name"
4. OR directly in database SQL:
```sql
UPDATE settings SET value = '"Your New Clinic Name"' WHERE key = 'clinic_name';
```

### Update Colors
Edit `tailwind.config.js`:
```javascript
colors: {
  'hot-pink': '#E91E63',  // Main button color
  'deep-pink': '#C2185B', // Secondary
  'light-pink': '#F06292', // Accents
  // ... update any color hex codes
}
```

### Add New Service
```sql
INSERT INTO services (name_ar, name_en, price, duration, category, active) VALUES
('اسم الخدمة', 'Service Name', 200.00, 45, 'skincare', true);
```

### Add New Therapist
Go to dashboard > Therapists > Add Therapist
Or via SQL:
```sql
INSERT INTO therapists (name, phone, specialization, bio) VALUES
('فاطمة احمد', '01000000001', 'Facial Treatments', 'Expert in skincare');
```

---

## 📦 Deployment

### Deploy to Vercel (Recommended)

1. **Push to GitHub**
```bash
git add .
git commit -m "Serenity Beauty Clinic v1.0.0"
git push origin main
```

2. **Connect to Vercel**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Select the project

3. **Add Environment Variables in Vercel**
   - Settings > Environment Variables
   - Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   - Deploy

4. **Custom Domain (Optional)**
   - Vercel Dashboard > Settings > Domains
   - Add your custom domain
   - Update DNS settings

---

## 📊 Project Structure

```
serenity-clinic/
├── src/
│   ├── pages/                    # Page components
│   │   ├── Dashboard.tsx
│   │   ├── POS.tsx
│   │   ├── Bookings.tsx
│   │   ├── Services.tsx
│   │   ├── Therapists.tsx        # (was Barbers, renamed)
│   │   ├── Clients.tsx
│   │   ├── Analytics.tsx
│   │   ├── Settings.tsx
│   │   ├── DailyLogs.tsx
│   │   ├── Expenses.tsx
│   │   ├── QueueDisplay.tsx
│   │   └── Login.tsx
│   ├── components/               # Reusable components
│   │   ├── layout/
│   │   ├── ui/
│   │   ├── forms/
│   │   └── ...
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.ts            # Authentication
│   │   ├── useTheme.ts           # Theme management
│   │   ├── useLanguage.ts        # Language switching
│   │   └── ...
│   ├── db/                       # Database client
│   │   └── supabase.ts
│   ├── utils/                    # Helper functions
│   │   ├── egyptTime.ts
│   │   ├── formatCurrency.ts
│   │   └── ...
│   ├── locales/                  # Translations
│   │   ├── ar.json               # Arabic
│   │   └── en.json               # English
│   ├── App.tsx                   # Main app container
│   └── main.tsx                  # Entry point
├── public/                       # Static assets
├── .env.local                    # (Create this!) Environment variables
├── package.json                  # Dependencies
├── tailwind.config.js            # Tailwind configuration
├── tsconfig.json                 # TypeScript configuration
├── vite.config.js                # Vite configuration
└── serenity_beauty_clinic_database.sql  # Database schema
```

---

## 🔐 Security

### Environment Variables
- ✅ Keep `.env.local` **private** (add to `.gitignore`)
- ✅ Use separate Vercel environment variables for production
- ✅ Never commit secrets to GitHub
- ✅ Rotate keys periodically

### Database Security
- ✅ RLS policies prevent unauthorized access
- ✅ Single admin has full control
- ✅ Clients cannot modify others' data
- ✅ All transactions are logged
- ✅ Backup system available in Supabase

### Passwords
- ✅ Use 12+ character passwords
- ✅ Mix of upper/lowercase, numbers, symbols
- ✅ Enable 2FA in Supabase if available
- ✅ Regular password updates recommended

---

## 🐛 Troubleshooting

### "Login fails with email/password"
1. Verify email matches exactly in Supabase > Auth > Users
2. Check user was created successfully
3. Verify `admin_auth` record exists:
```sql
SELECT * FROM admin_auth WHERE email = 'your_email@example.com';
```

### "Page shows loading forever"
1. Check `.env.local` has correct Supabase credentials
2. Verify Supabase project is not paused
3. Check browser console (F12) for errors
4. Network tab to verify API calls

### "Can't create bookings/transactions"
1. Verify services exist: `SELECT COUNT(*) FROM services;`
2. Verify services have `active = true`
3. Check therapists are created
4. Hard refresh page (Ctrl+Shift+R)

### "Currency/time display is wrong"
1. Go to Settings and update timezone
2. Update currency in settings
3. Check `locales/` files for translations

---

## 📞 Support & Resources

- **Supabase Docs:** https://supabase.com/docs
- **React Docs:** https://react.dev
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Vite Docs:** https://vitejs.dev

---

## ✅ Deployment Checklist

- [ ] Database migrated to Supabase
- [ ] Admin user created and linked
- [ ] `.env.local` created with credentials
- [ ] `npm install` completed
- [ ] `npm run dev` works without errors
- [ ] Can login with admin email/password
- [ ] Dashboard shows sample data
- [ ] Services visible in bookings
- [ ] Can create test client and booking
- [ ] POS checkout works
- [ ] Settings page loads
- [ ] All pages responsive on mobile
- [ ] Dark theme works correctly
- [ ] Arabic RTL displays correctly
- [ ] Ready for Vercel deployment

---

## 📄 License

**Proprietary** - This software is proprietary and confidential.

---

## 🎉 You're Ready to Go!

Your Serenity Beauty Clinic management system is ready for production.

**Happy managing!** 💅✨

---

*Built with ❤️ for beauty professionals*
