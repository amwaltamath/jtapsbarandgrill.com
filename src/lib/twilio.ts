import { Twilio } from 'twilio';

const accountSid = import.meta.env.TWILIO_ACCOUNT_SID;
const authToken = import.meta.env.TWILIO_AUTH_TOKEN;
const fromNumber = import.meta.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !fromNumber) {
  throw new Error('Twilio environment variables are not set. Please check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.');
}

export const twilio = new Twilio(accountSid, authToken);

export const sendSMS = async (to: string, message: string) => {
  try {
    const result = await twilio.messages.create({
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