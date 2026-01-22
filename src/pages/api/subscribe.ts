import type { APIRoute } from 'astro';
import { resend } from '../../lib/resend';
import { supabase } from '../../lib/supabase';

interface SubscribeRequest {
  email: string;
  name?: string;
}

export const POST: APIRoute = async (context) => {
  try {
    const body = await context.request.json() as SubscribeRequest;
    const { email, name } = body;

    // Validate email
    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Save subscriber to Supabase
    const { data: subscriber, error: dbError } = await supabase
      .from('newsletter_subscribers')
      .insert([
        { 
          email, 
          name: name || null,
          subscribed_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (dbError) {
      console.error('Supabase error:', dbError);
      // If duplicate email, return friendly message
      if (dbError.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'This email is already subscribed!' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Failed to save subscription' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Send welcome email via Resend
    const response = await resend.emails.send({
      from: 'JTAPS Bar and Grill <noreply@jtapsbarandgrill.com>',
      to: email,
      subject: '🎉 Welcome to JTAPS Bar and Grill Newsletter!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1a1a1a 0%, #E13622 100%); padding: 40px 20px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">JTAPS Bar and Grill</h1>
            <p style="margin: 10px 0 0 0;">Cincinnati's Premier Sports Bar Since 2006</p>
          </div>
          
          <div style="padding: 40px 20px; background: #f5f5f5;">
            <p style="font-size: 16px; line-height: 1.6;">Hi ${name ? name.split(' ')[0] : 'Friend'},</p>
            
            <p style="font-size: 16px; line-height: 1.6;">
              Thanks for subscribing to JTAPS Bar and Grill! You're now in the loop for:
            </p>
            
            <ul style="font-size: 16px; line-height: 1.8;">
              <li>🏈 Game day specials & promotions</li>
              <li>🍗 New menu items & seasonal favorites</li>
              <li>🎉 Exclusive events & happy hour deals</li>
              <li>📍 Special offers for our Glenway Ave location</li>
            </ul>
            
            <p style="font-size: 16px; line-height: 1.6;">
              <strong>Visit us soon!</strong><br>
              📍 6441 Glenway Ave, Cincinnati, OH 45211<br>
              📞 (513) 574-9777<br>
              🌐 jtapsbarandgrill.com
            </p>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Come watch the game with us—50+ HD TVs, famous wings, and cold beer await!
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
      console.error('Resend error:', response.error);
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Successfully subscribed! Check your email for details.',
        id: response.data?.id 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Subscribe error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
