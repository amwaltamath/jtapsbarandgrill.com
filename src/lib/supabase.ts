import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

// Only validate in browser/client context
if (typeof window !== 'undefined') {
  if (!import.meta.env.PUBLIC_SUPABASE_URL || !import.meta.env.PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Supabase environment variables are not set. Please check PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY.');
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client with service role (use only in API routes)
export const supabaseAdmin = createClient(
  supabaseUrl,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
);
