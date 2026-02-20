# Debugging the 400 Bad Request Error

## Quick Fix: Run Migration

1. Go to https://supabase.com/dashboard
2. Select your project (zyihjfkibyymcktyljlw)
3. Click **SQL Editor** (left sidebar)
4. Create a **New Query**
5. Copy entire `supabase-migration.sql` file contents
6. Click **Run**

This ensures all tables, columns, and policies exist.

## Check Table Structure

In Supabase SQL Editor, run:

```sql
-- Check if table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'newsletter_subscribers';

-- Check all columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'newsletter_subscribers';

-- Check policies
SELECT * FROM pg_policies 
WHERE tablename = 'newsletter_subscribers';
```

## Verify in Browser Console

In your browser Console (F12), after the error, run:

```javascript
// Test a simple query
const { data, error } = await supabase
  .from('newsletter_subscribers')
  .select('*')
  .limit(1);
  
console.log('Data:', data);
console.log('Error:', error);
```

## Common Issues

1. **Migration not run** - Run the full supabase-migration.sql in SQL Editor
2. **Missing columns** - Table exists but phone column wasn't added (ALTER TABLE didn't run)
3. **RLS blocking access** - Missing SELECT policy for authenticated users
4. **Browser cache** - Hard refresh (Ctrl+Shift+R) to clear old code

## Clear Browser Cache

1. Press Ctrl+Shift+R to hard refresh
2. Or go to DevTools > Application > Clear Storage > Clear site data
