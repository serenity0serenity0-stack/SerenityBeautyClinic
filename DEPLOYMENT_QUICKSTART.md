# 🚀 Quick Start - Vercel & Supabase Deployment

## 5-Minute Quick Setup

### Step 1: Supabase (3 min)
```bash
1. Go to supabase.com and create project: "serenity-beauty-clinic"
2. In SQL Editor, import: serenity-beauty-clinic-migration.sql
3. Copy API credentials from Settings → API
```

**Save These:**
- `VITE_SUPABASE_URL` = Project URL
- `VITE_SUPABASE_ANON_KEY` = Anon Key (public)

### Step 2: Vercel (2 min)
```bash
1. Go to vercel.com → Add Project
2. Import: github.com/serenity0serenity0-stack/SerenityBeautyClinic
3. Add Environment Variables:
   VITE_SUPABASE_URL=[your_url]
   VITE_SUPABASE_ANON_KEY=[your_key]
4. Deploy!
```

**Your app is live at:** `https://<project>.vercel.app`

---

## 🔑 Create First Admin

After deployment, create admin in Supabase:

1. **Auth User:** Create in Supabase Auth
   - Email: `admin@serenity-clinic.com`
   - Password: `your-secure-password`

2. **Admin Record:** Run in SQL Editor
```sql
-- Replace YOUR_USER_ID with actual user ID from Auth
INSERT INTO admin_auth (email, auth_user_id, clinic_id)
VALUES (
  'admin@serenity-clinic.com',
  'YOUR_USER_ID',
  'clinic-001'
);
```

3. **Login:** Visit your Vercel URL and use those credentials

---

## ✅ Verify Everything Works

- [ ] Application loads without errors
- [ ] Can login with admin credentials
- [ ] Dashboard displays correctly
- [ ] Services visible in settings
- [ ] Can create new clients/bookings

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Database error" | Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY |
| "Login fails" | Verify admin_auth record with matching email |
| "Build error" | Check Vercel logs → likely missing env vars |
| "CSS looks wrong" | Clear browser cache (Ctrl+Shift+Del) |

---

**Need more help?** See `VERCEL_DEPLOYMENT_GUIDE.md` for detailed setup

---

*Build Status: ✅ Production Ready*
*Build Size: 1.2 MB (minified) / 351 KB (gzipped)*
