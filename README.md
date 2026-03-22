# 💈 Barber Shop Management System

A professional, production-ready barber shop management and point-of-sale (POS) system built with **React + Framer Motion** and powered by **Supabase** (PostgreSQL).

🎨 **Features**: Modern glassmorphism design, Arabic/English localization (i18n), real-time analytics, receipt printing, VIP client tracking, expense management, **real-time queue system**, and more.

🇪🇬 **Designed for Egyptian barbershops** with Egyptian locale defaults (currency: ج.م, phone format, date formatting).

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- A Supabase account (free tier available at https://supabase.com)

### 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up for a free account
2. Create a new project
3. Once created, go to **Settings > API** and copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Anon Public Key** → `VITE_SUPABASE_ANON_KEY`

### 2. Set Up Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Create a new query and paste the entire content of `supabase-schema.sql` file from the project root
3. Click "Run" to execute the schema

### 3. Configure Environment

1. Open `.env.local` in the project root
2. Replace the placeholder values:
   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
3. Save the file

### 4. Install Dependencies

```bash
npm install
```

### 5. Start Development Server

```bash
npm run dev
```

The app will open at `http://localhost:5173`

---

## 📁 Project Structure

```
src/
├── components/
│   ├── layout/          # Sidebar, Header, Layout wrapper
│   ├── ui/              # Reusable UI components (GlassCard, Modal, Badge, QueueStatus, etc.)
│   ├── charts/          # Recharts visualizations
│   └── receipt/         # Receipt printing template
├── pages/
│   ├── Dashboard.tsx    # Overview & KPIs
│   ├── POS.tsx          # Point of Sale (cashier)
│   ├── Clients.tsx      # Client management
│   ├── Services.tsx     # Service & pricing management
│   ├── Expenses.tsx     # Expense tracking
│   ├── Analytics.tsx    # Revenue & analytics reports
│   ├── Bookings.tsx     # Advanced booking system with queue status
│   ├── QueueDisplay.tsx # Full-screen queue display
│   └── Settings.tsx     # App settings & preferences
├── db/
│   ├── supabase.ts      # Supabase client setup
│   └── hooks/           # Database hooks (useClients, useServices, useQueueStatus, etc.)
├── hooks/               # Custom React hooks (useTheme, useLanguage, etc.)
├── utils/               # Utility functions (formatting, CSV export, Egypt time, etc.)
├── locales/             # i18next translation files (ar.json, en.json)
├── App.tsx              # Main app component with routing
└── index.css            # Global styles + glassmorphism utilities
```

---

## 🎯 Core Features

### 1. **Customer Portal** — `/shop/:slug/*` ⭐ **NEW**
- **5 Professional Templates**: Choose from Modern Minimalist, Luxury Premium, Dark Modern, Gradient, or Colorful designs
- **Fully Customizable**: Colors, welcome message, branding
- **Live Preview**: See how your portal looks before publishing
- **Secure Access**: Customers register and login to book appointments
- **Multi-Shop Support**: Each shop has unique portal with independent settings
- **One-Click Admin Control**: Enable/disable portal from settings
- **Auto-Created**: Portal automatically created when adding new shop

#### Portal Pages:
- **Landing** - 5 template options with live preview
- **Login/Register** - Secure customer authentication
- **Dashboard** - Customer overview with stats
- **Bookings** - Real-time availability and appointment booking
- **History** - Past visits and transactions
- **Profile** - Update customer information

### 2. **Point of Sale (POS)** — `/pos`
- **Phone-first client search**: Type phone number to instantly find returning clients
- **Service grid**: Browse services by category with one-click add to cart
- **Dynamic cart**: Quantity controls, discount (% or fixed), payment method selection
- **Receipt generation**: Formatted for 80mm thermal printers
- **Auto-tracking**: Updates client visit count, total spent, favorite services
- **VIP automation**: Automatically marks clients as VIP when threshold reached

### 2. **Dashboard** — `/`
- **KPI Cards**: Today's revenue, clients, expenses with animated counters
- **Recent Transactions**: Last 5 sales with details
- **Birthday Reminders**: Clients with upcoming birthdays
- **Inactive Alerts**: Clients who haven't visited in 30+ days

### 3. **Bookings & Queue System** — `/bookings` & `/queue` ⭐ **NEW**
- **Real-time Queue Display**: Shows people ahead, expected wait time, and completion time
- **Smart Scheduling**: Calculates availability based on barber workload and service duration
- **Conflict Prevention**: 30-minute buffer to prevent double-booking
- **Full-Screen Display**: Dedicated page (`/queue`) for waiting area screens
- **Live Updates**: Updates every second with current time
- **Arabic & English**: Full bilingual support with proper RTL/LTR directions

#### Queue Features:
```
┌─────────────────────────────────┐
│  أمامك في الدور: 3              │ ← People Ahead
│  الانتظار المتوقع: 75 دقيقة     │ ← Expected Wait
│  الوقت المتوقع: 11:30 ص         │ ← Estimated Time
│  الوقت الحالي: 10:15:45         │ ← Live Clock
└─────────────────────────────────┘
```

**Usage:**
- **Dashboard View**: See queue widget on Bookings page
- **Full Screen**: Navigate to `/queue` for waiting area display
- **Smart Calculation**: Automatically sums service durations for accurate wait times

### 4. **Client Management** — `/clients`
- **CRM System**: Track visit history, total spent, favorite services
- **VIP Tracking**: Automatic VIP status awarding
- **Birthday Reminders**: Never miss customer birthdays
- **Search & Filter**: Quick client lookup and categorization

### 5. **Services Management** — `/services`
- **Bilingual Service Names**: Arabic and English support
- **Dynamic Pricing**: Easy price adjustment
- **Duration Control**: Set expected service duration (for queue calculations)
- **Bulk Updates**: Update prices in batch

### 6. **Analytics & Reports** — `/analytics`
- **Revenue Trends**: Daily/monthly revenue visualization
- **Client Analytics**: Top clients, unique visitors
- **Payment Breakdown**: Cash vs Card vs E-Wallet statistics
- **Export Options**: CSV and PDF reports

### 7. **Expense Management** — `/expenses`
- **Category Tracking**: Supplies, rent, utilities, salary, maintenance
- **Monthly Summary**: Total expenses by category
- **Date Filtering**: Track expenses over time periods

### 8. **Settings & Configuration** — `/settings`
- **Barbershop Profile**: Name, logo, address, phone
- **Display Preferences**: Theme (dark/light), language (Arabic/English)
- **VIP Configuration**: Define VIP threshold (visits or amount)
- **Barber Management**: Add/edit barber profiles
- **Data Management**: Export/import/reset system data

---

## 🌍 Language Support

### Arabic (العربية)
- Full RTL support
- Proper text alignment
- Egyptian locale (EGY)
- All features translated

### English
- Full LTR support
- All features translated

**Switch languages** in Settings (top-right corner)

---

## 🟡 Recent Improvements & Fixes

### ✅ Customer Portal System (March 2026) 🎉 NEW
**Complete customer-facing booking portal with 5 customizable templates**

#### Portal Features:
- **5 Professional Templates**: Modern Minimalist, Luxury Premium, Dark Modern, Gradient, Colorful
- **Live Template Preview**: See exactly how your portal looks before publishing
- **Customizable Branding**: 
  - Primary, secondary, and accent colors
  - Personalized welcome message
  - Unique portal slug per shop
  - Can be disabled/enabled by admin
- **Auto Portal Creation**: Portal settings automatically created when shop is added
- **Multi-Shop Support**: Each shop gets its own independent portal with unique slug
- **Data Isolation**: Secure multi-tenant isolation - customers can only see their own shop

#### Portal Pages:
- 🏠 **Landing Page** - 5 different template designs
- 🔐 **Login** - Secure customer authentication  
- 📝 **Register** - New customer signup
- 📊 **Dashboard** - Customer stats and quick links
- 📅 **Bookings** - Browse available times and create appointments
- 📜 **History** - View past visits and transactions
- 👤 **Profile** - Update personal information

#### Admin Portal Management:
- **Settings Page**: Edit portal colors, templates, welcome message, enable/disable
- **Real-time Preview**: See changes instantly as you edit
- **Auto-disable on Suspension**: Portal automatically disabled when shop is inactive/suspended
- **Better Loading States**: Improved UI feedback while portal settings load

#### Security & Fixes (March 22, 2026):
✅ Fixed column name mismatches (isActive → active)  
✅ Fixed table name references (portal_customers → customer_users)  
✅ Added shop_id isolation to prevent cross-shop data access  
✅ Added is_active portal status check  
✅ Enhanced error handling for missing portals  
✅ Fixed settings table schema compatibility  

---

### ✅ Earlier Improvements (Previous Sessions)
1. **Fixed Logic Error** in queue percentage calculation - now accurate
2. **Standardized Arabic Translations** - consistent throughout system
3. **Added Missing Translations** - complete i18n coverage
4. **System Quality Report** - comprehensive audit completed
5. **Queue System Optimization** - improved performance and accuracy

See `SYSTEM_QUALITY_REPORT.md` for detailed findings.

---

## 📊 Database Schema

### Main Tables:
- **clients** - Customer profiles and history
- **services** - Available services with pricing and duration
- **transactions** - Sales records
- **expenses** - Expense tracking
- **bookings** - Appointment scheduling (NEW)
- **barbers** - Barber/staff profiles
- **settings** - System configuration

---

## 🔐 Security Features

- ✅ Row-level security (RLS) enabled on Supabase
- ✅ Environment variables for sensitive data
- ✅ Authentication ready (can add auth module)
- ✅ Data validation on frontend and backend

---

## 📚 Additional Documentation

### Queue System (NEW)
- **[QUEUE_SYSTEM_DOCS.md](QUEUE_SYSTEM_DOCS.md)** - Complete technical documentation
- **[QUEUE_QUICK_START.md](QUEUE_QUICK_START.md)** - Quick reference guide
- **[QUEUE_REFERENCE_GUIDE.md](QUEUE_REFERENCE_GUIDE.md)** - Visual and technical reference

### General Documentation
- **[BOOKING_SYSTEM_README.md](BOOKING_SYSTEM_README.md)** - Booking system details
- **[SYSTEM_QUALITY_REPORT.md](SYSTEM_QUALITY_REPORT.md)** - Quality audit report

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Framer Motion |
| **Styling** | Tailwind CSS, Glassmorphism |
| **Database** | Supabase (PostgreSQL) |
| **Internationalization** | i18next |
| **Charts** | Recharts |
| **Printing** | React-to-Print |
| **Notifications** | React Hot Toast |
| **Build** | Vite, PostCSS |

---

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Deploy to Vercel
Configuration included in `vercel.json`

```bash
npm install -g vercel
vercel
```

---

## 🐛 Troubleshooting

### Queue Not Updating
- Ensure bookings are created with correct status (pending/ongoing)
- Check that booking times are in the future
- Refresh page if needed

### Translations Not Showing
- Verify locale files in `src/locales/`
- Check language selection in Settings
- Browser cache may need clearing

### Database Connection Issues
- Verify Supabase credentials in `.env.local`
- Check Supabase project is active
- Ensure schema is properly imported

---

## 📋 Feature Checklist

### Implemented ✅
- [x] POS System
- [x] Client Management
- [x] Service Management
- [x] Analytics & Reports
- [x] Expense Tracking
- [x] Booking System with Smart Scheduling
- [x] Real-time Queue Display
- [x] **Customer Portal with 5 Templates** ⭐ NEW
- [x] Portal Live Preview & Customization ⭐ NEW
- [x] Multi-Shop Portal Management ⭐ NEW
- [x] Arabic/English Support
- [x] Receipt Printing
- [x] VIP Tracking
- [x] Dark/Light Theme

### Planned 🔮
- [ ] SMS/Email Notifications
- [ ] WhatsApp Integration
- [ ] Staff Commission Tracking
- [ ] Inventory Management
- [ ] Video/Photo Gallery
- [ ] Portal SMS/Email Notifications
- [ ] Mobile App (React Native)
- [ ] Audio Alerts for Queue

---

## 🏢 **NEW: Multi-Tenant SaaS System** ✨

This system has been upgraded to a **production-ready SaaS platform**! Multiple barbershop owners can now use the same system with complete data isolation.

### SaaS Features ✅

#### 🔐 Authentication System
- Unified login for both admins and shop owners
- Automatic role detection
- Route-based access control
- Session management with logout

#### 🏪 Multi-Tenancy
- Complete data isolation per shop
- Row-Level Security (RLS) enforced
- All queries automatically filtered by shop_id
- Zero cross-shop data visibility

#### 👨‍💼 Admin Panel
- **Admin Dashboard**: System-wide statistics (total shops, active shops, revenue)
- **Shop Management**: View/update all shops, manage subscription status
- **Plan Management**: Create/edit/delete pricing plans

#### 💳 Billing & Subscription
- **3 Pricing Models**:
  - Per Transaction (e.g., $5/booking)
  - Per Service (e.g., $8/service item)
  - Quota Plan (e.g., $99/month for 100 transactions)
- **Automatic Usage Tracking**: Database triggers log all billable actions
- **Subscription Status**: Active, expiring, expired, suspended
- **Quota Management**: Track usage and enforce limits

#### 📊 Subscription Alerts
- Real-time status display on dashboard
- Color-coded alerts (green/yellow/orange/red)
- Shows days remaining, quota usage, plan details
- Automatic refresh every minute

### Test the SaaS System

**Admin Account:**
```
Email: yaa2003ya@gmail.com
Role: Administrator
Access: /admin (dashboard, shops, plans management)
```

**Shop Owner Account:**
```
Email: shop1@gmail.com
Role: Shop Owner
Access: /dashboard (shop-specific features)
```

### SaaS Architecture

```
Public Internet
    ↓
[Login Page] → Auto Role Detection
    ↓              ↓
Admin Route    Shop Route
/admin         /dashboard
/admin/shops   /pos
/admin/plans   /clients
               /services
                   ↓
            Supabase Auth + RLS
                   ↓
            PostgreSQL Database
```

### Complete SaaS Documentation

📖 **For detailed SaaS documentation, see: [README_SAAS.md](README_SAAS.md)**

This includes:
- Complete feature documentation
- Database schema details
- Deployment instructions
- Testing scenarios
- Troubleshooting guide

---

## 📞 Support & Feedback

For issues, bugs, or feature requests, create an issue in the repository.

---

## 📄 License

This project is provided as-is for commercial use in Egyptian barbershops.

---

## 🎉 Credits

Built with ❤️ for Egyptian barbershops  
**Made in Egypt 🇪🇬**

---

**Last Updated:** March 19, 2026  
**Version:** 2.0.0 (with Queue System)  
**Status:** Production Ready ✅

### 3. **Client Management** — `/clients`
- Search & filter (by name, phone, VIP status)
- Full client profiles: name, phone, birthday, notes, visit history
- Total spent & visit count tracking
- VIP status with progress indicators
- Add/edit/delete clients

### 4. **Services & Pricing** — `/services`
- Browse services by category (haircut, beard, skincare, kids, packages)
- Quick inline price editing
- Bulk price updates (% increase/decrease)
- Active/inactive toggle
- Add/edit/delete service management

### 5. **Expenses** — `/expenses`
- Category-based expense tracking (supplies, rent, utilities, salary, etc.)
- Date-based filtering & search
- Monthly summary with category breakdown
- Add/edit/delete expenses

### 6. **Analytics** — `/analytics`
- Date range selector (week, month, quarter)
- KPI dashboard: revenue, expenses, net profit, transaction count, avg ticket
- Revenue trend line chart (interactive Recharts)
- Payment method breakdown
- Top services & clients leaderboards

### 7. **Settings** — `/settings`
- Barbershop profile (name, phone, address)
- Display preferences (language: العربية/English, theme: dark/light)
- VIP threshold configuration
- Data management (export/import JSON backups, reset data)

---

## 🌐 Language & Theme

### Switching Language
Click the **language toggle** in the top header to switch between:
- **العربية** (Arabic) — RTL layout, Egyptian locale
- **English** — LTR layout

Language preference is saved to `localStorage`.

### Dark/Light Mode
Click the **theme toggle** (🌙/☀️) in the top header. Dark mode is the default.

Theme preference is saved to `localStorage`.

---

## 📊 Database Schema

All data is stored in Supabase PostgreSQL tables:

- **clients**: Name, phone, birthday, VIP status, visit history
- **services**: Arabic/English names, price, duration, category
- **transactions**: Sales records with items, discount, total, payment method
- **expenses**: Category, amount, date, notes
- **settings**: App configuration (barbershop name, themes, VIP thresholds)
- **barbers**: Barber information (optional multi-barber support)

---

## 🖨️ Printing

### Receipt Printing
1. Complete a sale in POS
2. A receipt modal appears with all transaction details
3. Click the print button or press `Ctrl+P`
4. Your printer will open with the 80mm-formatted receipt
5. Print to a thermal receipt printer for best results

### Report Printing
Any page with a report (client history, expenses, analytics) includes a print button:
- Page layouts automatically hide UI elements when printing
- Charts are replaced with clean text summaries
- Reports are formatted for A4 paper

---

## ⌨️ Keyboard Shortcuts

- **N** — New Sale (open POS)
- **C** — Clients page
- **E** — Expenses page
- **Ctrl+P** — Print current view
- **Esc** — Close any modal

---

## 🔧 Development

### Run Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

---

## 📦 Tech Stack

| Technology | Purpose |
|-----------|---------|
| **React 18** | UI framework |
| **Vite** | Build tool & dev server |
| **TypeScript** | Type safety |
| **Tailwind CSS** | Styling & glassmorphism utilities |
| **Framer Motion** | Smooth animations & transitions |
| **Supabase** | Backend database (PostgreSQL) |
| **i18next** | Arabic/English translations |
| **Recharts** | Data visualization (charts) |
| **react-hot-toast** | Toast notifications |
| **Fuse.js** | Fuzzy search (clients/services) |
| **Lucide React** | Icon library |

---

## 🎨 Design System

### Color Palette
- **Primary (Gold)**: `#D4AF37` — Accent color for buttons, active states
- **Dark Background**: `#0A0F1E` — Main background (dark mode)
- **Secondary Dark**: `#111827` — Sidebar, cards
- **Glass**: `rgba(255,255,255,0.1)` with `backdrop-blur(20px)` — Card backgrounds

### Typography
- **Cairo** (Google Fonts) — Arabic text, beautiful for Arabic UI
- **Outfit** — English/numbers, modern sans-serif
- **Font Sizes**: 12px (small), 14px (body), 16px (labels), 20px+ (headings)

### Border Radius
- `16px` — Cards & major components
- `12px` — Buttons & inputs
- `8px` — Small elements

### Animations
- Page transitions: `slide + fade` 
- Card entrance: `stagger + scale-up`
- Modal open/close: Spring animation
- Hover effects: Lift effect on cards (+shadow, -4px translate Y)

---

## 🚀 Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repository
3. In **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Click "Deploy"

### Deploy to Other Platforms

The app is a static React app that can be deployed to:
- **Netlify**: Drag & drop `dist/` folder or connect GitHub
- **GitHub Pages**: Use `gh-pages` package
- **Firebase Hosting**: Run `npm run build` and deploy `dist/`
- **Any static host** (AWS S3, Cloudflare Pages, etc.)

---

## 🔐 Security Notes

- The `VITE_SUPABASE_ANON_KEY` is **intentionally public** (it's designed for client-side use)
- For production, enable **Row Level Security (RLS)** in Supabase to restrict data access
- Never commit `.env.local` with real credentials to version control
- Supabase provides free SSL/HTTPS by default

---

## 📱 Mobile & Tablet Support

The app is fully responsive:
- **Mobile** (< 768px): Single-column layout, collapsible sidebar
- **Tablet** (768px–1024px): Two-column, touchscreen optimized
- **Desktop** (> 1024px): Full layout with sidebar

**Install as PWA**:
1. Open the app in Chrome/Edge
2. Click the install icon (usually in address bar)
3. Run the app like a native app on your device

---

## ❓ Troubleshooting

### Supabase Connection Issues
- Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
- Verify RLS policies allow public read/write (see `supabase-schema.sql`)
- Check Supabase project status in the dashboard

### Missing Data After Reload
- Sample data is seeded on first load
- Check Supabase **Database** > navigate to tables to verify data exists
- If missing, manually run `supabase-schema.sql` again

### Print Not Working
- Ensure your browser allows pop-ups for printing
- Check that `@media print` CSS is applied
- Use Chrome or Edge for best thermal printer compatibility

### Language Not Switching
- Clear `localStorage` in browser DevTools
- Refresh the page after toggling language
- Check that `src/locales/ar.json` and `en.json` exist

---

## 📝 License

This project is created for Egyptian barbershops. Feel free to customize and use.

---

## 🇪🇬 شكراً!

Made with ❤️ for the Egyptian business community.

**Barber Shop Management System** — *Professional solutions for modern barbershops*
