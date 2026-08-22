/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  readonly PUBLIC_VAPID_PUBLIC_KEY: string;
  readonly VAPID_PRIVATE_KEY: string;
  readonly VAPID_SUBJECT: string;
  readonly FOCUS_POS_API_URL?: string;
  readonly FOCUS_POS_USER_ID?: string;
  readonly FOCUS_POS_PASSWORD?: string;
  readonly FOCUS_POS_MERCHANT_ID?: string;
  readonly FOCUS_POS_MEMO?: string;
  readonly FOCUS_POS_OPERATOR_ID?: string;
  readonly FOCUS_POS_REQUEST_FORMAT?: string;
  readonly FOCUS_POS_XML_PARAM?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
