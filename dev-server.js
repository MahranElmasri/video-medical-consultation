/**
 * Development server for API endpoints
 * Runs on port 3001 and serves the Vercel serverless functions locally
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sendInvitation from './api/send-invitation.js';
import testApi from './api/test.js';

// Load environment variables
dotenv.config({ path: '.env' });

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Mock Vercel request/response for local development
const createMockVercelHandler = (handler) => {
  return async (req, res) => {
    // Mock Vercel's response methods
    const mockRes = {
      ...res,
      status: (code) => {
        res.status(code);
        return mockRes;
      },
      json: (data) => {
        return res.json(data);
      },
      setHeader: (key, value) => {
        res.setHeader(key, value);
      },
    };

    await handler(req, mockRes);
  };
};

// API Routes
app.post('/api/send-invitation', createMockVercelHandler(sendInvitation));
app.options('/api/send-invitation', createMockVercelHandler(sendInvitation));
app.get('/api/test', createMockVercelHandler(testApi));

// Start server
app.listen(PORT, () => {
  console.log(`✓ Dev API server running on http://localhost:${PORT}`);
  console.log(`✓ Environment variables loaded: ${process.env.SMTP_HOST ? 'Yes' : 'No'}`);
});
