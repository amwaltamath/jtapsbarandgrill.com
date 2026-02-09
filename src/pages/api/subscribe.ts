import type { APIRoute } from 'astro';
import { resend } from '../../lib/resend';
import { supabase } from '../../lib/supabase';

interface SubscribeRequest {
  email?: string;
  phone?: string;
  name?: string;
  smsOptIn?: boolean;
  emailOptIn?: boolean;
}

export const POST: APIRoute = async (context) => {
  try {
    const body = await context.request.json() as SubscribeRequest;
    const { email, phone, name, smsOptIn = false, emailOptIn = true } = body;

    // Validate that at least one contact method is provided
    if (!email && !phone) {
      return new Response(
        JSON.stringify({ error: 'Please provide either an email or phone number' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate email if provided
    if (email && !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate phone if provided
    if (phone && !/^\+?1?[-.\s]?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/.test(phone.replace(/\D/g, ''))) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Save subscriber to Supabase
    const { data: subscriber, error: dbError } = await supabase
      .from('newsletter_subscribers')
      .insert([
        { 
          email: email || null,
          phone: phone || null,
          name: name || null,
          sms_opt_in: smsOptIn,
          email_opt_in: emailOptIn,
          subscribed_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (dbError) {
      console.error('Supabase error:', dbError);
      // If duplicate email or phone, return friendly message
      if (dbError.code === '23505') {
        const duplicateField = email ? 'email' : 'phone number';
        return new Response(
          JSON.stringify({ error: `This ${duplicateField} is already subscribed!` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Failed to save subscription' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Send welcome email if email was provided and opted in
    if (email && emailOptIn) {
      try {
        const response = await resend.emails.send({
          from: 'JTAPS Bar and Grill <noreply@jtapsbarandgrill.com>',
          to: email,
          subject: '🎉 Welcome to JTAPS Bar and Grill Newsletter!',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #1a1a1a 0%, #E13622 100%); padding: 40px 20px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">Welcome to JTAPS! 🍺</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px;">Thanks for joining our newsletter!</p>
              </div>
              <div style="background: white; padding: 40px 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="color: #333; margin-top: 0;">${name ? `Hi ${name}!` : 'Hello!'}</h2>
                <p style="color: #666; line-height: 1.6; font-size: 16px;">You're now signed up to receive:</p>
                <ul style="color: #666; line-height: 1.8;">
                  <li>🏈 Game day specials and promotions</li>
                  <li>🍗 New menu items and limited-time offers</li>
                  <li>🎉 Exclusive events and happy hour deals</li>
                  <li>📺 Sports bar updates and TV schedules</li>
                </ul>
                <p style="color: #666; font-size: 16px;">Visit us at <strong>6441 Glenway Ave, Cincinnati, OH</strong> or call <strong>(513) 574-9777</strong> to place your order!</p>
                <div style="text-align: center; margin-top: 30px;">
                  <a href="https://jtapsbarandgrill.com" style="background: #E13622; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Visit Our Website</a>
                </div>
              </div>
            </div>
          `,
        });
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        // Don't fail the subscription if email fails
      }
    }
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
