/**
 * Vercel Serverless Function for sending consultation invitation emails
 * Uses Resend API (compatible with Vercel serverless restrictions)
 */

import { Resend } from 'resend';

export default async function handler(req, res) {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ message: 'OK' });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST requests are accepted'
    });
  }

  try {
    const { email, roomUrl, roomId } = req.body;

    // Validate required fields
    if (!email || !roomUrl || !roomId) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'email, roomUrl, and roomId are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide a valid email address'
      });
    }

    // Get Resend API key from environment variables
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      console.error('Missing RESEND_API_KEY in environment variables');
      return res.status(500).json({
        error: 'Email service not configured',
        message: 'Email API key is missing. Please contact administrator.'
      });
    }

    // Initialize Resend
    const resend = new Resend(resendApiKey);

    // HTML email template
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
    }
    .button {
      display: inline-block;
      background: #667eea;
      color: white !important;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 8px;
      font-weight: 600;
      margin: 25px 0;
      font-size: 16px;
      transition: background 0.3s ease;
    }
    .button:hover {
      background: #5568d3;
    }
    .instructions {
      background: #f9fafb;
      border-left: 4px solid #667eea;
      padding: 20px;
      margin: 25px 0;
      border-radius: 4px;
    }
    .instructions h3 {
      margin-top: 0;
      color: #667eea;
      font-size: 16px;
    }
    .instructions ol {
      margin: 10px 0;
      padding-left: 25px;
    }
    .instructions li {
      margin: 8px 0;
    }
    .security {
      background: #ecfdf5;
      border: 1px solid #10b981;
      border-radius: 8px;
      padding: 20px;
      margin: 25px 0;
    }
    .security h3 {
      margin-top: 0;
      color: #059669;
      font-size: 16px;
    }
    .security ul {
      margin: 10px 0;
      padding-left: 25px;
    }
    .security li {
      margin: 8px 0;
    }
    .footer {
      text-align: center;
      color: #6b7280;
      font-size: 13px;
      padding: 30px;
      background-color: #f9fafb;
      border-top: 1px solid #e5e7eb;
    }
    .room-id {
      background: #f3f4f6;
      padding: 12px;
      border-radius: 6px;
      font-family: 'Courier New', monospace;
      margin: 15px 0;
      font-size: 14px;
    }
    .link-box {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      padding: 15px;
      border-radius: 6px;
      margin: 20px 0;
      word-break: break-all;
    }
    .warning {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .center {
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏥 Einladung zur medizinischen Videosprechstunde</h1>
    </div>

    <div class="content">
      <p style="font-size: 16px; margin-top: 0;">Guten Tag,</p>

      <p>Sie wurden zu einer sicheren Videosprechstunde mit Ihrem Arzt eingeladen.</p>

      <div class="center">
        <a href="${roomUrl}" class="button">📱 Jetzt zur Sprechstunde</a>
      </div>

      <div class="instructions">
        <h3>📋 So nehmen Sie teil:</h3>
        <ol>
          <li>Klicken Sie auf den Button oben oder nutzen Sie den Link unten</li>
          <li>Geben Sie Ihren vollständigen Namen ein</li>
          <li>Klicken Sie auf "Beitrittsanfrage senden"</li>
          <li>Warten Sie, bis der Arzt Ihre Anfrage annimmt</li>
          <li>Die Videosprechstunde beginnt automatisch</li>
        </ol>
      </div>

      <div class="link-box">
        <strong>Direkter Link:</strong><br>
        <a href="${roomUrl}" style="color: #667eea;">${roomUrl}</a>
      </div>

      <div class="room-id">
        <strong>Raum-ID:</strong> ${roomId}
      </div>

      <div class="security">
        <h3>🔒 Sicherheit & Datenschutz:</h3>
        <ul>
          <li>Alle Video- und Audiodaten sind Ende-zu-Ende verschlüsselt</li>
          <li>HIPAA-konforme Plattform</li>
          <li>Keine Daten werden auf unseren Servern gespeichert</li>
          <li>Vollständige Privatsphäre garantiert</li>
        </ul>
      </div>

      <div class="warning">
        <strong>⏰ Wichtig:</strong> Dieser Einladungslink ist aus Sicherheitsgründen 6 Stunden gültig.
      </div>

      <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
        Bei Fragen wenden Sie sich bitte direkt an Ihre Arztpraxis.
      </p>
    </div>

    <div class="footer">
      <p><strong>Sichere medizinische Videosprechstunde</strong></p>
      <p>MVZ El-Sharafi - Dies ist eine automatische Nachricht.</p>
    </div>
  </div>
</body>
</html>
    `;

    // Plain text version
    const textContent = `
Einladung zur medizinischen Videosprechstunde

Guten Tag,

Sie wurden zu einer sicheren Videosprechstunde mit Ihrem Arzt eingeladen.

TEILNAHME:
${roomUrl}

ANLEITUNG:
1. Klicken Sie auf den Link oben
2. Geben Sie Ihren vollständigen Namen ein
3. Klicken Sie auf "Beitrittsanfrage senden"
4. Warten Sie, bis der Arzt Ihre Anfrage annimmt
5. Die Videosprechstunde beginnt automatisch

SICHERHEIT & DATENSCHUTZ:
• Alle Video- und Audiodaten sind Ende-zu-Ende verschlüsselt
• HIPAA-konforme Plattform
• Keine Daten werden auf unseren Servern gespeichert
• Dieser Link ist 6 Stunden gültig

Raum-ID: ${roomId}

---
Bei Fragen wenden Sie sich bitte direkt an Ihre Arztpraxis.

Sichere medizinische Videosprechstunde
MVZ El-Sharafi
    `;

    // Send email using Resend with verified domain
    const data = await resend.emails.send({
      from: 'MVZ El-Sharafi <send@mvz-elsharafi.de>',
      to: [email],
      subject: 'Ihre Einladung zur Videosprechstunde',
      html: htmlContent,
      text: textContent,
    });

    console.log('Email sent successfully:', data);
    console.log('Message ID:', data.id);

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Invitation email sent successfully',
      messageId: data.id,
    });

  } catch (error) {
    console.error('Email sending error:', error);

    // Ensure we always return a JSON response
    return res.status(500).json({
      success: false,
      error: 'Failed to send email',
      message: error.message || 'An unexpected error occurred while sending the email',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}
