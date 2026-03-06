interface EmailTemplateProps {
  recipientName?: string;
  content: string;
  preheader?: string;
}

export function createEmailTemplate({ recipientName, content, preheader }: EmailTemplateProps): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  ${preheader ? `<meta name="description" content="${preheader}">` : ''}
  <title>JTAPS Bar & Grill</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, Helvetica, sans-serif;
      background-color: #f4f4f4;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      border: 0;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }
    .preheader {
      display: none !important;
      visibility: hidden;
      mso-hide: all;
      font-size: 1px;
      color: #f4f4f4;
      line-height: 1px;
      max-height: 0px;
      max-width: 0px;
      opacity: 0;
      overflow: hidden;
    }
    /* Responsive */
    @media only screen and (max-width: 480px) {
      .email-content-cell {
        padding-left: 16px !important;
        padding-right: 16px !important;
      }
      .email-header-title {
        font-size: 24px !important;
      }
      .cta-button {
        width: 100% !important;
        text-align: center !important;
      }
    }
  </style>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; width: 100% !important;">
  ${preheader ? `<div class="preheader">${preheader}</div>` : ''}
  
  <!-- Email Container -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; width: 100% !important; margin: 0; padding: 0;">
    <tr>
      <td align="center" style="padding: 0;">
        <!-- Email Content Table -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; background-color: #ffffff;">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #1a1a1a; padding: 40px 30px; text-align: center;" class="email-content-cell">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td style="background-color: #E13622; border-radius: 50%; width: 70px; height: 70px; text-align: center; vertical-align: middle; font-size: 32px; font-weight: bold; color: #ffffff; font-family: Georgia, serif;">JT</td>
                </tr>
              </table>
              <h1 class="email-header-title" style="color: #ffffff; margin: 20px 0 10px; font-size: 28px; font-weight: bold; line-height: 1.3;">JTAPS Bar &amp; Grill</h1>
              <p style="color: #cccccc; margin: 0; font-size: 16px;">Sports &#8226; Food &#8226; Fun</p>
            </td>
          </tr>

          <!-- Greeting -->
          ${recipientName ? `
          <tr>
            <td style="padding: 30px 30px 10px; color: #333333; font-size: 18px; font-weight: bold;" class="email-content-cell">
              Hi ${recipientName},
            </td>
          </tr>
          ` : ''}

          <!-- Main Content -->
          <tr>
            <td style="padding: ${recipientName ? '10px' : '30px'} 30px 30px; color: #333333; font-size: 16px; line-height: 1.6;" class="email-content-cell">
              ${content}
            </td>
          </tr>

          <!-- Call to Action Section -->
          <tr>
            <td style="padding: 20px 30px; text-align: center; background-color: #f9f9f9;" class="email-content-cell">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto; width: 100%; max-width: 400px;">
                <tr>
                  <td class="cta-button" style="background-color: #E13622; border-radius: 6px; padding: 16px 32px; text-align: center;">
                    <a href="https://jtapsbarandgrill.com" style="color: #ffffff; text-decoration: none; font-size: 18px; font-weight: bold; display: block;">Visit Our Website</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Location & Contact Info -->
          <tr>
            <td style="padding: 30px; background-color: #1a1a1a; color: #ffffff; text-align: center;" class="email-content-cell">
              <p style="margin: 0 0 15px; font-size: 18px; font-weight: bold;">📍 Find Us</p>
              <p style="margin: 0 0 5px; font-size: 14px; line-height: 1.6;">
                6441 Glenway Avenue<br>
                Cincinnati, OH 45211
              </p>
              <p style="margin: 15px 0 5px; font-size: 14px;">
                📞 <a href="tel:+15136442337" style="color: #E13622; text-decoration: none;">(513) 644-2337</a>
              </p>
              <p style="margin: 5px 0; font-size: 14px;">
                🌐 <a href="https://jtapsbarandgrill.com" style="color: #E13622; text-decoration: none;">jtapsbarandgrill.com</a>
              </p>
            </td>
          </tr>

          <!-- Social Media Links -->
          <tr>
            <td style="padding: 20px; background-color: #1a1a1a; text-align: center;" class="email-content-cell">
              <p style="color: #ffffff; margin: 0 0 15px; font-size: 14px; font-weight: bold;">Follow Us</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td style="padding: 0 10px;">
                    <a href="https://facebook.com/jtapsbarandgrill" style="color: #E13622; text-decoration: none; font-size: 24px;">📘</a>
                  </td>
                  <td style="padding: 0 10px;">
                    <a href="https://instagram.com/jtapsbarandgrill" style="color: #E13622; text-decoration: none; font-size: 24px;">📷</a>
                  </td>
                  <td style="padding: 0 10px;">
                    <a href="https://twitter.com/jtapsbar" style="color: #E13622; text-decoration: none; font-size: 24px;">🐦</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #0d0d0d; color: #999999; font-size: 12px; text-align: center; line-height: 1.6;" class="email-content-cell">
              <p style="margin: 0 0 10px;">
                You're receiving this email because you subscribed to updates from JTAPS Bar & Grill.
              </p>
              <p style="margin: 0 0 10px;">
                <a href="https://jtapsbarandgrill.com/unsubscribe" style="color: #E13622; text-decoration: underline;">Unsubscribe</a> | 
                <a href="https://jtapsbarandgrill.com/preferences" style="color: #E13622; text-decoration: underline;">Email Preferences</a>
              </p>
              <p style="margin: 0; color: #666666;">
                © ${new Date().getFullYear()} JTAPS Bar & Grill. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  `.trim();
}

// Quick templates for common scenarios
export const emailTemplates = {
  gameAlert: (gameName: string, dateTime: string, channel: string) => `
    <h2 style="color: #E13622; margin: 0 0 15px; font-size: 22px;">🏈 Big Game Alert!</h2>
    <p style="margin: 0 0 15px;">Get ready for an exciting matchup:</p>
    <div style="background: #f0f0f0; padding: 20px; border-radius: 8px; border-left: 4px solid #E13622; margin: 20px 0;">
      <p style="margin: 0 0 8px; font-size: 18px; font-weight: bold; color: #1a1a1a;">${gameName}</p>
      <p style="margin: 0 0 8px; color: #555;">📅 ${dateTime}</p>
      <p style="margin: 0; color: #555;">📺 ${channel}</p>
    </div>
    <p style="margin: 20px 0 0;">Join us for the game, great food, and an unbeatable atmosphere!</p>
  `,

  specialOffer: (title: string, description: string, discount: string) => `
    <h2 style="color: #E13622; margin: 0 0 15px; font-size: 22px;">🎉 Special Offer!</h2>
    <div style="background: linear-gradient(135deg, #E13622 0%, #b8291b 100%); color: #ffffff; padding: 25px; border-radius: 8px; text-align: center; margin: 20px 0;">
      <p style="margin: 0 0 10px; font-size: 24px; font-weight: bold;">${title}</p>
      <p style="margin: 0 0 15px; font-size: 18px; opacity: 0.95;">${description}</p>
      <p style="margin: 0; font-size: 28px; font-weight: bold; background: rgba(255,255,255,0.2); display: inline-block; padding: 10px 20px; border-radius: 6px;">${discount}</p>
    </div>
    <p style="margin: 20px 0 0;">Don't miss out on this limited-time offer. See you soon!</p>
  `,

  announcement: (title: string, message: string) => `
    <h2 style="color: #E13622; margin: 0 0 15px; font-size: 22px;">${title}</h2>
    <p style="margin: 0 0 15px; line-height: 1.6;">${message}</p>
    <p style="margin: 20px 0 0;">We can't wait to see you at JTAPS!</p>
  `
};
