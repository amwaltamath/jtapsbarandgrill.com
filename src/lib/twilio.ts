function getEnv(key: string): string {
  return import.meta.env[key] || process.env[key] || '';
}

export const sendSMS = async (to: string, message: string) => {
  const accountSid = getEnv('TWILIO_ACCOUNT_SID');
  const authToken = getEnv('TWILIO_AUTH_TOKEN');
  const fromNumber = getEnv('TWILIO_PHONE_NUMBER');

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio is not configured. Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.');
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({
    To: to,
    From: fromNumber,
    Body: message,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || `Twilio error ${result.code}: ${result.more_info}`);
  }

  return result;
};