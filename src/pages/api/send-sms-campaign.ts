import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { sendSMS } from '../../lib/twilio';

interface SMSCampaignRequest {
  message: string;
  subscribers: Array<{ phone: string; name: string | null }>;
}

export const POST: APIRoute = async (context) => {
  try {
    // Check authentication
    const authHeader = context.request.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await context.request.json() as SMSCampaignRequest;
    const { message, subscribers } = body;

    if (!message || !subscribers || subscribers.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Send SMS to all subscribers
    let sent = 0;
    let failed = 0;
    const results = [];

    for (const subscriber of subscribers) {
      try {
        // Personalize message if name is available
        const personalizedMessage = subscriber.name
          ? Hi 6{subscriber.name}, 6{message}
          : message;

        await sendSMS(subscriber.phone, personalizedMessage);
        sent++;
        results.push({ phone: subscriber.phone, status: 'sent' });
      } catch (error) {
        console.error(Failed to send SMS to 6{subscriber.phone}:, error);
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ phone: subscriber.phone, status: 'failed', error: errorMessage });
      }
    }

    // Save campaign record
    const { data: campaign, error: dbError } = await supabase
      .from('sms_campaigns')
      .insert([{
        message,
        sent_count: sent
      }])
      .select()
      .single();

    if (dbError) {
      console.error('Failed to save SMS campaign:', dbError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        failed,
        total: subscribers.length,
        results,
        campaignId: campaign?.id
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('SMS campaign error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
