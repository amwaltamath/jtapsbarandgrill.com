import type { APIRoute } from "astro";
import { sendSMS } from "../../lib/twilio";

export const GET: APIRoute = async ({ url }) => {
  const headers = { "Content-Type": "application/json" };
  const testPhone = url.searchParams.get("to");

  // Step 1: Check env vars
  const sid = process.env.TWILIO_ACCOUNT_SID || import.meta.env.TWILIO_ACCOUNT_SID || '';
  const token = process.env.TWILIO_AUTH_TOKEN || import.meta.env.TWILIO_AUTH_TOKEN || '';
  const phone = process.env.TWILIO_PHONE_NUMBER || import.meta.env.TWILIO_PHONE_NUMBER || '';

  const envCheck = {
    TWILIO_ACCOUNT_SID: sid ? `${sid.slice(0, 6)}...${sid.slice(-4)}` : 'NOT SET',
    TWILIO_AUTH_TOKEN: token ? `${token.slice(0, 4)}...${token.slice(-4)}` : 'NOT SET',
    TWILIO_PHONE_NUMBER: phone || 'NOT SET',
  };

  // Step 2: If ?to= param provided, try sending
  if (testPhone) {
    try {
      const result = await sendSMS(testPhone, "JTAPS debug test");
      return new Response(
        JSON.stringify({ envCheck, smsResult: "SUCCESS", sid: result.sid }),
        { status: 200, headers }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({
          envCheck,
          smsResult: "FAILED",
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack?.split("\n").slice(0, 5) : undefined,
        }),
        { status: 200, headers }
      );
    }
  }

  return new Response(
    JSON.stringify({ envCheck, hint: "Add ?to=+15136596307 to attempt a test SMS" }),
    { status: 200, headers }
  );
};
