import { Resend } from 'resend';

const resendApiKey = import.meta.env.RESEND_API_KEY;

export const getResend = () => {
  if (!resendApiKey) {
    return null;
  }
  return new Resend(resendApiKey);
};
