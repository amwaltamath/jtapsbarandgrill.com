import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;
let supabaseAdminInstance: SupabaseClient | null = null;

function getSupabaseClient() {
  if (!supabaseInstance) {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    // Validate URLs are actual HTTP/HTTPS URLs, not undefined or empty strings
    if (supabaseUrl && typeof supabaseUrl === 'string' && supabaseUrl.startsWith('http') && 
        supabaseAnonKey && typeof supabaseAnonKey === 'string') {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    } else {
      console.warn('Supabase environment variables are not properly configured.');
      // Return a dummy/null client to prevent hydration errors
      supabaseInstance = null;
    }
  }
  return supabaseInstance;
}

function getSupabaseAdminClient() {
  if (!supabaseAdminInstance) {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && typeof supabaseUrl === 'string' && supabaseUrl.startsWith('http') && 
        serviceRoleKey && typeof serviceRoleKey === 'string') {
      supabaseAdminInstance = createClient(supabaseUrl, serviceRoleKey);
    } else {
      console.warn('Supabase admin environment variables are not properly configured.');
      supabaseAdminInstance = null;
    }
  }
  return supabaseAdminInstance;
}

/** Use for null checks — `supabaseAdmin` is a Proxy and is always truthy. */
export function getSupabaseAdmin(): SupabaseClient | null {
  return getSupabaseAdminClient();
}

export function getSupabase(): SupabaseClient | null {
  return getSupabaseClient();
}

function bindClientMethod<T extends SupabaseClient>(client: T, prop: keyof T) {
  const value = client[prop];
  if (typeof value === 'function') {
    return (value as (...args: unknown[]) => unknown).bind(client);
  }
  return value;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    if (!client) {
      return undefined;
    }
    return bindClientMethod(client, prop as keyof SupabaseClient);
  },
});

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdminClient();
    if (!client) {
      return undefined;
    }
    return bindClientMethod(client, prop as keyof SupabaseClient);
  },
});
