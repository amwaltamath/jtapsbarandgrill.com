# JTAPS Admin Dashboard Setup

## 🎯 What's Been Created

1. **Admin Login & Dashboard** - `/admin` route with authentication
2. **Subscriber Management** - View all newsletter subscribers
3. **Email Campaign Tool** - Send promotional emails to all subscribers
4. **Supabase Integration** - Subscribers saved to database

## 📋 Setup Instructions

### 1. Create Supabase Database Table

Go to your Supabase SQL Editor and run the migration:

```sql
-- Copy and paste the contents of supabase-migration.sql
```

Or manually:
1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Go to SQL Editor
3. Copy contents from `supabase-migration.sql`
4. Click "Run"

### 2. Create Admin User

In Supabase Dashboard:
1. Go to **Authentication** → **Users**
2. Click **Add User** → **Create New User**
3. Enter email and password for admin access
4. Confirm email (or disable email confirmation in Auth settings)

### 3. Get Service Role Key (Optional - for server-side operations)

1. Go to **Settings** → **API**
2. Copy the `service_role` secret key
3. Add to `.env`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

### 4. Test the System

1. Run `npm run dev`
2. Visit `http://localhost:4321/admin`
3. Login with your admin credentials
4. View subscribers and send promotional emails

## 🔐 Security Notes

- Only authenticated users can access the admin dashboard
- Subscribers table uses Row Level Security (RLS)
- Public can only INSERT (sign up)
- Only authenticated users can READ (view subscribers)
- Service role key should NEVER be exposed to client

## 📧 Features

### Subscriber Management
- View all newsletter subscribers
- See signup dates
- Export data (table format)

### Email Campaigns
- Compose custom promotional emails
- HTML support in email body
- Send to all subscribers at once
- Track sent/failed emails
- Branded email templates

## 🚀 Next Steps

1. Configure your domain with Resend for branded emails
2. Set up email templates for common campaigns
3. Add subscriber export functionality
4. Create scheduled campaigns
5. Add analytics tracking
