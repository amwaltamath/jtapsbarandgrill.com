import type { APIRoute } from 'astro';
import { resend } from '../../lib/resend';

interface PromoEmailRequest {
  subject: string;
  message: string;
  subscribers: Array<{ email: string; name: string | null }>;
}

export const POST: APIRoute = async (context) => {
  try {
    const body = await context.request.json() as PromoEmailRequest;
    const { subject, message, subscribers } = body;

    if (!subject || !message || !subscribers || subscribers.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Send emails to all subscribers
    let sent = 0;
    let failed = 0;

    for (const subscriber of subscribers) {
      try {
        const response = await resend.emails.send({
          from: 'JTAPS Bar and Grill <noreply@jtapsbarandgrill.com>',
          to: subscriber.email,
          subject: subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #1a1a1a 0%, #E13622 100%); padding: 40px 20px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0;">JTAPS Bar and Grill</h1>
                <p style="margin: 10px 0 0 0;">Cincinnati's Premier Sports Bar Since 2006</p>
              </div>
              
              <div style="padding: 40px 20px; background: #f5f5f5;">
                <p style="font-size: 16px; line-height: 1.6;">Hi ${subscriber.name ? subscriber.name.split(' ')[0] : 'Friend'},</p>
                
                <div style="font-size: 16px; line-height: 1.6;">
                  ${message}
                </div>
                
                <p style="font-size: 16px; line-height: 1.6; margin-top: 30px;">
                  <strong>Visit us soon!</strong><br>
                  📍 6441 Glenway Ave, Cincinnati, OH 45211<br>
                  📞 (513) 574-9777<br>
                  🌐 jtapsbarandgrill.com
                </p>
              </div>
              
              <div style="background: #1a1a1a; color: white; padding: 20px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px;">
                <p style="margin: 0;">© 2026 JTAPS Bar and Grill. All rights reserved.</p>
                <p style="margin: 5px 0 0 0;"><a href="https://jtapsbarandgrill.com" style="color: #E13622; text-decoration: none;">Visit our website</a></p>
              </div>
            </div>
          `,
        });

        if (response.error) {
          console.error(`Failed to send to ${subscriber.email}:`, response.error);
          failed++;
        } else {
          sent++;
        }
      } catch (err) {
        console.error(`Error sending to ${subscriber.email}:`, err);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent,
        failed,
        message: `Successfully sent ${sent} emails${failed > 0 ? `, ${failed} failed` : ''}` 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Promo email error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
