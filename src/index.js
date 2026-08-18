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
app.options('*', cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// URL Normalizer for Vercel Serverless Rewrites
app.use((req, res, next) => {
  if (!req.url.startsWith('/api') && !req.url.startsWith('/uploads') && req.url !== '/') {
    req.url = '/api' + (req.url.startsWith('/') ? '' : '/') + req.url;
  }
  next();
});

// 2. Blueprint Standard Response Normalizer ({ ok, success, message, data, error })
app.use(responseNormalizer);

// 3. Static File Directories Setup (Skipped on Vercel serverless read-only environment)
if (!process.env.VERCEL) {
  const uploadDirs = ['uploads/branding', 'uploads/deposits', 'uploads/promotions', 'uploads/kyc'];
  uploadDirs.forEach(dir => {
    try {
      const fullPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    } catch (e) {
      console.warn(`Directory setup skipped for ${dir}:`, e.message);
    }
  });
}

if (env.EXPOSE_UPLOADS_PUBLIC) {
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
}

// 4. Server Root & Health Check Endpoints
app.get('/', (req, res) => {
  return res.json({
    ok: true,
    message: 'Succeed Capital CRM Backend Engine API Server is running',
    health_check: '/api/health',
    version: '1.0.0'
  });
});

const healthHandler = (req, res) => {
  return res.json({
    message: 'Vintage CRM Backend Engine is healthy',
    data: {
      status: 'online',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      external_crm_api_version: 'v1'
    }
  });
};

app.get('/api/health', healthHandler);
app.get('/health', healthHandler);

// 5. Mount Core Application REST Routes (Dual-Mounted for Vercel Rewrites compatibility)
const routesMap = [
  ['/api/auth', authRoutes],
  ['/auth', authRoutes],
  ['/api/user', userRoutes],
  ['/user', userRoutes],
  ['/api/trading-accounts', accountRoutes],
  ['/trading-accounts', accountRoutes],
  ['/api/financials', financialRoutes],
  ['/financials', financialRoutes],
  ['/api/ib', ibRoutes],
  ['/ib', ibRoutes],
  ['/api/kyc', kycRoutes],
  ['/kyc', kycRoutes],
  ['/api/leads', leadRoutes],
  ['/leads', leadRoutes],
  ['/api/support', supportRoutes],
  ['/support', supportRoutes],
  ['/api/analysis', analysisRoutes],
  ['/analysis', analysisRoutes],
  ['/api/admin', adminRoutes],
  ['/admin', adminRoutes],
  ['/api/webhooks', webhookRoutes],
  ['/webhooks', webhookRoutes]
];

routesMap.forEach(([path, routeHandler]) => {
  app.use(path, routeHandler);
});

// 6. Mount External CRM Interoperability API Gateway
app.use('/api/v1/external', externalCrmRoutes);
app.use('/v1/external', externalCrmRoutes);

// 7. JSON 404 Handler for Unmatched API Endpoints
app.use((req, res) => {
  return res.status(404).json({
    ok: false,
    success: false,
    message: `API endpoint ${req.method} ${req.url} not found`,
    data: null,
    error: 'NotFound'
  });
});

// 8. Global Catch-All Error Handler
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
