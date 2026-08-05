# 🚀 VERCEL DEPLOYMENT - ENVIRONMENT VARIABLES SETUP

## Step 1: Get Supabase Credentials

Go to your Supabase project:
1. Open: https://app.supabase.com
2. Select: **serenity-beauty-clinic** project
3. Click: **Settings → API**
4. Copy these values:

### Values to Copy:

**VITE_SUPABASE_URL:**
```
https://xxxxx.supabase.co
```

**VITE_SUPABASE_ANON_KEY:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Step 2: Add to Vercel

### In Vercel Dashboard:

1. Go to your project deployment page
2. Click: **Settings** → **Environment Variables**
3. Add each variable:

### Variable 1:
```
Name: VITE_SUPABASE_URL
Value: https://your-supabase-url.supabase.co
```

### Variable 2:
```
Name: VITE_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIs...
```

4. Click **Save**

---

## Step 3: Redeploy

1. Go to **Deployments** tab
2. Find your latest deployment
3. Click **⋮ → Redeploy**
4. OR push new code to trigger rebuild

```bash
git add .
git commit -m "Update env config"
git push origin master
```

---

## ✅ Then Your App Will:

✅ Connect to Supabase database  
✅ Load services and specialists  
✅ Allow admin login  
✅ Work fully  

**Status: 🟢 DEPLOYMENT READY**

---

## 🔗 Quick Checklist

- [ ] Copied VITE_SUPABASE_URL from Supabase
- [ ] Copied VITE_SUPABASE_ANON_KEY from Supabase
- [ ] Added both to Vercel Settings → Environment Variables
- [ ] Clicked Save
- [ ] Triggered redeploy or pushed code
- [ ] Build completed successfully
- [ ] App loads at your Vercel URL 🌸
