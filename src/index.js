import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { env } from './config/env.js';
import { initDb } from './config/db.js';
import { seedDatabase } from './db/seed.js';
import { responseNormalizer } from './middleware/responseNormalizer.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initSockets } from './sockets/index.js';
import { connectMt5Bridge } from './services/mt5BridgeService.js';

// Import Route Handlers
import authRoutes from './routes/authRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import financialRoutes from './routes/financialRoutes.js';
import ibRoutes from './routes/ibRoutes.js';
import kycRoutes from './routes/kycRoutes.js';
import leadRoutes from './routes/leadRoutes.js';
import supportRoutes from './routes/supportRoutes.js';
import analysisRoutes from './routes/analysisRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import userRoutes from './routes/userRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import externalCrmRoutes from './routes/externalCrmRoutes.js';

const app = express();
const server = http.createServer(app);

// 1. Security & Body Parsing Middlewares
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: '*', // Allow client portal, terminal workstation, and external CRM domains
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CRM-API-Key', 'X-CRM-API-Secret']
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// 2. Blueprint Standard Response Normalizer ({ ok, success, message, data, error })
app.use(responseNormalizer);

// 3. Static File Directories Setup
const uploadDirs = ['uploads/branding', 'uploads/deposits', 'uploads/promotions', 'uploads/kyc'];
uploadDirs.forEach(dir => {
  const fullPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

if (env.EXPOSE_UPLOADS_PUBLIC) {
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
}

// 4. Server Health Check Endpoint
app.get('/api/health', (req, res) => {
  return res.json({
    message: 'Vintage CRM Backend Engine is healthy',
    data: {
      status: 'online',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      external_crm_api_version: 'v1'
    }
  });
});

// 5. Mount Core Application REST Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/trading-accounts', accountRoutes);
app.use('/api/financials', financialRoutes);
app.use('/api/ib', ibRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhooks', webhookRoutes);

// 6. Mount External CRM Interoperability API Gateway
app.use('/api/v1/external', externalCrmRoutes);

// 7. Global Catch-All Error Handler
app.use(errorHandler);

// 8. Start Server, Sockets & Background Services
const startServer = async () => {
  await initDb();
  await seedDatabase();
  
  // Initialize Socket.IO Server
  initSockets(server);

  // Connect MetaTrader 5 SignalR Bridge Service
  connectMt5Bridge();

  server.listen(env.PORT, () => {
    console.log(`
===================================================================
🚀 VINTAGE CRM BACKEND ENGINE IS RUNNING!
🌐 Server Base URL:      http://localhost:${env.PORT}
📊 Health Check:         http://localhost:${env.PORT}/api/health
⚡ Socket.IO Gateway:    ws://localhost:${env.PORT}
🔌 External CRM API:     http://localhost:${env.PORT}/api/v1/external
===================================================================
    `);
  });
};

// Only listen when running standalone process (not on Vercel serverless environment)
if (!process.env.VERCEL) {
  startServer();
} else {
  initDb().catch(err => console.warn('Serverless DB init warning:', err.message));
}

export default app;
