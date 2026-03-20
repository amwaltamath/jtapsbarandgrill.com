# JTAPS Admin Dashboard Setup

## 🎯 What's Been Created

1. **Admin Login & Dashboard** - `/admin` route with role-based authentication
2. **User Management** - Manage admin users and assign roles
3. **Role-Based Access Control** - Fine-grained permissions for different user types
4. **Subscriber Management** - View all newsletter subscribers
5. **Email Campaign Tool** - Send promotional emails to all subscribers
6. **Supabase Integration** - All data saved to database
7. **Admin Portal Link** - Footer link to admin dashboard

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
3. Enter email and password
4. Confirm email (or disable email confirmation in Auth settings)
5. Then go to **Table Editor** → `admin_users`
6. Click **Insert Row** and add:
   - `user_id`: UUID of the user from step 3
   - `email`: Their email address
   - `role`: `admin` (for full access) or `beer_menu` (beer menu only)

**Or use the Admin Portal:**
1. Visit `/admin` and login with an existing admin account
2. Go to the **Users** tab
3. Click **Promote** on any user to make them an admin
4. Use the role dropdown to set their access level

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

- Only authenticated users in `admin_users` table can access the admin dashboard
- Users are assigned roles that restrict tab/feature access
- Subscribers table uses Row Level Security (RLS)
- Public can only INSERT (sign up)
- Only authenticated users can READ (view subscribers)
- Service role key should NEVER be exposed to client
- All role changes are validated server-side in `/api/admin/users`

## 📧 Features & Roles

### Admin Role (Full Access)
- **Overview Dashboard** - View all statistics and metrics
- **Content Management** - Game calendar, specials, menu items, beer menu
- **Customer Tools** - Check-ins, loyalty programs, promo codes, user management
- **Campaigns** - Email and SMS marketing campaigns
- **User Management** - Promote/demote users and assign roles

### Beer Menu Role (Limited Access)
- **Beer Menu Tab Only** - Manage and update the beer menu
- Cannot access other admin features
- Ideal for staff who only manage the beer inventory/display

### Subscriber Management (All Admins)
- View all newsletter subscribers
- See signup dates and opt-in preferences
- Export data (table format)

### Email Campaigns (All Admins)
- Compose custom promotional emails
- HTML support in email body
- Send to all subscribers at once
- Track sent/failed emails
- Branded email templates

### SMS Campaigns (All Admins)
- Send SMS messages to opted-in subscribers
- Track delivery and responses
- Twilio integration for reliable delivery

## �️ Admin User Management

### Creating Different User Types

**To create a beer menu manager:**
1. Have an admin user logged in
2. Go to **Users** tab
3. Click **Promote** on the target user
4. Use the role dropdown to select **"Beer Menu Only"**

**To create a full admin:**
1. Promote the user as above
2. Set the role dropdown to **"Admin (Full Access)"**

### Tab Access by Role

| Tab | Admin | Beer Menu |
|-----|-------|----------|
| Overview | ✅ | ❌ |
| Analytics | ✅ | ❌ |
| Game Calendar | ✅ | ❌ |
| Specials | ✅ | ❌ |
| Menu | ✅ | ❌ |
| **Beer Menu** | **✅** | **✅** |
| Check-Ins | ✅ | ❌ |
| Loyalty | ✅ | ❌ |
| Promo Codes | ✅ | ❌ |
| Users | ✅ | ❌ |
| Email Campaigns | ✅ | ❌ |
| SMS Campaigns | ✅ | ❌ |

## 🚀 Next Steps

1. Configure your domain with Resend for branded emails
2. Set up email templates for common campaigns
3. Add scheduled campaigns
4. Add analytics tracking
5. Create additional roles (e.g., email-only, loyalty-only) as needed

## 📍 Accessing the Admin Portal

- **Direct URL**: Visit `/admin` route
- **Footer Link**: Click **Admin** link in the page footer (Privacy Policy • Terms & Conditions • **Admin**)
- **Login**: Use Supabase authentication credentials
