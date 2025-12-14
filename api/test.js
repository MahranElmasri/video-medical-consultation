/**
 * Simple test endpoint to verify API is working
 */

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  return res.status(200).json({
    success: true,
    message: 'API is working!',
    method: req.method,
    timestamp: new Date().toISOString(),
    env: {
      smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
      smtpHost: process.env.SMTP_HOST || 'Not set',
      smtpUser: process.env.SMTP_USER || 'Not set',
    }
  });
};

module.exports.default = module.exports;
