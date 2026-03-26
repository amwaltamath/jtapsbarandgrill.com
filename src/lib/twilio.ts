import { Twilio } from 'twilio';

function getEnv(key: string): string {
  return import.meta.env[key] || process.env[key] || '';
}

let twilioInstance: Twilio | null = null;

function getTwilioClient(): Twilio | null {
  if (!twilioInstance) {
    const accountSid = getEnv('TWILIO_ACCOUNT_SID');
    const authToken = getEnv('TWILIO_AUTH_TOKEN');
    if (accountSid && authToken) {
      twilioInstance = new Twilio(accountSid, authToken);
    }
  }
  return twilioInstance;
}

function getFromNumber(): string {
  return getEnv('TWILIO_PHONE_NUMBER');
}

export const sendSMS = async (to: string, message: string) => {
  const client = getTwilioClient();
  const fromNumber = getFromNumber();
  if (!client || !fromNumber) {
    throw new Error('Twilio is not configured. Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.');
  }
  try {
    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: to
    });
    return result;
  } catch (error) {
    console.error('SMS sending failed:', error);
    throw error;
  }
};