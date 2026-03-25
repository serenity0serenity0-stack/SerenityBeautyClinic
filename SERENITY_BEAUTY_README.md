# 🌸 Serenity Beauty Clinic

**Professional Beauty & Wellness Management System**

A modern, elegant single-admin platform for managing beauty clinics, spas, and wellness centers. Built with React 18, TypeScript, Vite, and Supabase.

**Status**: ✅ Production Ready | **Version**: 1.0.0 | **License**: Proprietary

---

## 🎯 What is Serenity Beauty Clinic?

Serenity Beauty Clinic is a complete management solution for beauty professionals. Whether you run a hair salon, nail studio, makeup boutique, or med-spa, this system provides everything you need to run your business efficiently.

### Perfect For:
- 💇‍♀️ Hair & Beauty Salons
- 💅 Nail Studios  
- 💄 Makeup Boutiques
- 🧖‍♀️ Spas & Wellness Centers
- 💆 Aesthetic Clinics

---

## ✨ Key Features

### 💳 Point-of-Sale (POS) System
- Search clients by name or phone
- Dynamic shopping cart with multiple services
- Apply percentage or fixed discounts
- Multiple payment methods (Cash, Card, E-Wallet)
- Professional receipt printing with VIP tracking
- Real-time transaction recording

### 👥 Client Management
- Complete client database with history
- Track visit count & total spending
- VIP status management
- Birthday reminders
- Favorite services tracking
- Contact information & notes

### 📅 Advanced Booking System
- Smart booking calendar
- Auto-assign beauty specialists
- Conflict prevention (15-minute buffer)
- Real-time wait time calculation
- Booking status tracking (Pending, Ongoing, Completed, Cancelled)
- Service duration estimation

### 🎯 Queue Management (Real-Time)
- Live queue display with people ahead
- Predicted wait times
- Estimated completion time
- Progress percentage
- Auto-updates every second
- Professional layout for waiting areas

### 💇‍♀️ Beauty Specialist Management
- Add unlimited specialists
- Track specializations
- Manage availability
- View performance metrics
- Schedule optimization

### 🛍️ Service Management
- Organize by category (Hair, Nails, Makeup, Skincare)
- Set pricing & duration dynamically
- Manage service variants
- Track availability
- Beautiful categorization system

### 📊 Analytics & Reporting
- Daily revenue tracking
- Monthly performance metrics
- Client acquisition insights
- Top services analysis
- KPI dashboard
- Export capabilities

### 💰 Expense Tracking
- Categorize business expenses
- Monthly summaries
- Cost analysis
- Profit margins

### 🌐 Multi-Language Support
- Arabic (العربية) - Full RTL support
- English - Full LTR support
- Switch languages instantly
- RTL/LTR automatic layout adjustment

### 🎨 Beautiful UI/UX
- Modern glassmorphism design
- Pink & purple beauty theme
- Dark/Light mode support
- Responsive mobile design
- Smooth animations
- Accessibility features

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Supabase account (free tier available)
- GitHub account (for code hosting)
- Vercel account (for deployment)

### Installation

#### 1. Database Setup (Supabase)
```bash
# 1. Create Supabase project at https://supabase.com
# 2. Get your:
#    - Project URL
#    - Anon Public Key

# 3. Run database migration:
#    - Go to Supabase > SQL Editor
#    - Copy contents of serenity-beauty-clinic-migration.sql
#    - Paste and execute
```

#### 2. Local Development
```bash
# Clone or download project
cd serenity-beauty-clinic

# Create environment file
echo "VITE_SUPABASE_URL=your_supabase_url" > .env.local
echo "VITE_SUPABASE_ANON_KEY=your_anon_key" >> .env.local

# Install dependencies
npm install

# Start development server
npm run dev

# Visit http://localhost:5173
```

#### 3. Create Admin User
```sql
-- In Supabase SQL Editor:
-- 1. Get clinic_id:
SELECT id FROM clinic;

-- 2. Create auth user in Supabase Console > Auth > Users
-- 3. Get the auth_user_id:
SELECT id FROM auth.users WHERE email = 'your_email@example.com';

-- 4. Link auth user to clinic:
INSERT INTO admin_auth (auth_user_id, clinic_id, role)
VALUES ('AUTH_USER_ID', 'CLINIC_ID', 'admin');
```

#### 4. Login
- Email: Your Supabase auth email
- Password: Your Supabase auth password
- Enjoy! 🎉

---

## 📂 Project Structure

```
serenity-beauty-clinic/
├── src/
│   ├── pages/                    # Main app pages
│   │   ├── Dashboard.tsx         # Analytics dashboard
│   │   ├── POS.tsx              # Cashier system
│   │   ├── Bookings.tsx         # Appointment management
│   │   ├── QueueDisplay.tsx     # Queue display
│   │   ├── Clients.tsx          # Client management
│   │   ├── Services.tsx         # Service management
│   │   ├── Barbers.tsx          # Beauty specialist management
│   │   ├── Expenses.tsx         # Expense tracking
│   │   ├── Analytics.tsx        # Reports & insights
│   │   ├── Settings.tsx         # System settings
│   │   ├── DailyLogs.tsx        # Transaction history
│   │   └── Login.tsx            # Authentication
│   │
│   ├── components/              # Reusable components
│   │   ├── layout/              # Layout components
│   │   ├── ui/                  # UI components
│   │   ├── receipt/             # Receipt templates
│   │   └── subscription/        # Status alerts
│   │
│   ├── hooks/                   # Custom React hooks
│   │   ├── useAuth.ts           # Authentication
│   │   ├── useTheme.ts          # Theme management
│   │   ├── useLanguage.ts       # Language management
│   │   └── useKeyboardShortcuts.ts
│   │
│   ├── db/                      # Database layer
│   │   ├── supabase.ts          # Supabase client
│   │   └── hooks/               # Database hooks
│   │
│   ├── utils/                   # Utility functions
│   ├── locales/                 # i18n translations
│   └── App.tsx                  # Main app component
│
├── public/                      # Static assets
├── package.json                 # Dependencies
├── tailwind.config.js           # Tailwind theme (pink colors)
├── tsconfig.json                # TypeScript config
├── vite.config.ts               # Vite config
└── serenity-beauty-clinic-migration.sql  # Database schema
```

---

## 🎨 Color Theme

The system uses a beautiful pink and women-focused color palette:

- **Primary**: `#E91E63` (Hot Pink)
- **Secondary**: `#C2185B` (Deep Pink)
- **Accent**: `#F06292` (Light Pink)
- **Purple**: `#CE93D8` (Soft Purple)

Edit in `tailwind.config.js` to customize colors.

---

## 🌐 Deployment

### Deploy to Vercel (Recommended)
```bash
# 1. Push to GitHub
git push origin main

# 2. Go to https://vercel.com
# 3. Import repository
# 4. Add environment variables
# 5. Deploy!
```

See [SERENITY_DEPLOYMENT_GUIDE.md](./SERENITY_DEPLOYMENT_GUIDE.md) for detailed instructions.

---

## 🔐 Security

### Authentication
- Supabase Auth for admin login
- Session-based authentication
- Password encryption

### Data Protection
- Supabase PostgreSQL database
- No multi-tenant data mixing (single clinic)
- Automatic daily backups
- HTTPS on all connections

### Privacy
- GDPR-compliant
- Client data not shared
- Secure transaction logging

---

## 📚 Documentation

- **[SERENITY_DEPLOYMENT_GUIDE.md](./SERENITY_DEPLOYMENT_GUIDE.md)** - Full deployment instructions
- **[serenity-beauty-clinic-migration.sql](./serenity-beauty-clinic-migration.sql)** - Database schema & setup

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS |
| **Database** | Supabase (PostgreSQL) |
| **Authentication** | Supabase Auth |
| **Forms** | React Hook Form + Zod |
| **State Management** | React Hooks |
| **Internationalization** | i18next |
| **Charts & UI** | Recharts, Lucide React |
| **Animations** | Framer Motion |
| **Printing** | React-to-print |
| **Notifications** | React Hot Toast |
| **Deployment** | Vercel |

---

## 📖 Usage Guide

### First Login
1. Open https://serenity-beauty-clinic.vercel.app (or your domain)
2. Use your admin credentials
3. Go to Settings to configure clinic info

### Adding Services
1. Settings → Services → Add Service
2. Fill: Name (Arabic & English), Price, Duration, Category
3. Save - immediately available

### Adding Beauty Specialists
1. Settings → Beauty Specialists → Add Specialist
2. Fill: Name, Phone, Email, Specialization
3. Save - ready to assign to bookings

### Processing Sales
1. POS → Search client
2. Add services to cart
3. Apply discounts if needed
4. Select payment method
5. Print receipt
6. Done! 🎉

### Viewing Queue
1. Queue Display → Shows real-time queue
2. Check people ahead
3. See wait time & expected completion
4. Perfect for waiting area screens

---

## ❓ FAQ

**Q: Can I use this for multiple clinics?**  
A: No, this version is for single clinic. The original system supports multi-clinic.

**Q: Is there a client portal?**  
A: This version is admin-only. Customer portals can be added separately.

**Q: Can I export reports?**  
A: Yes! Reports can be exported as CSV from Analytics dashboard.

**Q: Is backup automatic?**  
A: Yes! Supabase automatically backs up daily.

**Q: Can I customize colors?**  
A: Absolutely! Edit `tailwind.config.js` and `src/index.css`

**Q: Is it mobile friendly?**  
A: Yes! Fully responsive design for tablets and phones.

---

## 📞 Support

For issues or questions:
1. Check [SERENITY_DEPLOYMENT_GUIDE.md](./SERENITY_DEPLOYMENT_GUIDE.md) troubleshooting section
2. Check Supabase documentation: https://supabase.com/docs
3. Contact: [Your contact info]

---

## 📄 License

Proprietary - All rights reserved

---

## 🙏 Credits

Built with modern web technologies and designed for beauty professionals.

---

**Made with ❤️ for beauty professionals** ✨

*Serenity Beauty Clinic v1.0.0 - March 25, 2026*
