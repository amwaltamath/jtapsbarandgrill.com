import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  const headers = { "Content-Type": "application/json" };
  
  const sid = process.env.TWILIO_ACCOUNT_SID || import.meta.env.TWILIO_ACCOUNT_SID || '';
  const token = process.env.TWILIO_AUTH_TOKEN || import.meta.env.TWILIO_AUTH_TOKEN || '';
  const phone = process.env.TWILIO_PHONE_NUMBER || import.meta.env.TWILIO_PHONE_NUMBER || '';

  return new Response(
    JSON.stringify({
      TWILIO_ACCOUNT_SID: sid ? `${sid.slice(0, 6)}...${sid.slice(-4)}` : 'NOT SET',
      TWILIO_AUTH_TOKEN: token ? `${token.slice(0, 4)}...${token.slice(-4)}` : 'NOT SET',
      TWILIO_PHONE_NUMBER: phone || 'NOT SET',
      source: {
        process_env_sid: !!process.env.TWILIO_ACCOUNT_SID,
        import_meta_sid: !!import.meta.env.TWILIO_ACCOUNT_SID,
        process_env_token: !!process.env.TWILIO_AUTH_TOKEN,
        import_meta_token: !!import.meta.env.TWILIO_AUTH_TOKEN,
        process_env_phone: !!process.env.TWILIO_PHONE_NUMBER,
        import_meta_phone: !!import.meta.env.TWILIO_PHONE_NUMBER,
      }
    }),
    { status: 200, headers }
  );
};
