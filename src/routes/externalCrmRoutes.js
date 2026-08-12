import express from 'express';
import {
  syncExternalUser,
  getExternalUser,
  provisionExternalAccount,
  postExternalDeposit,
  subscribeExternalWebhook
} from '../controllers/externalCrmController.js';
import { authenticateExternalCrm } from '../middleware/externalApiAuth.js';

const router = express.Router();

// Require X-CRM-API-Key and X-CRM-API-Secret for all external CRM endpoints
router.use(authenticateExternalCrm);

// User Interoperability & Sync
router.post('/users/sync', syncExternalUser);
router.get('/users/:identifier', getExternalUser);

// Trading Account Remote Management
router.post('/accounts/create', provisionExternalAccount);

// Cross-CRM Transactions
router.post('/transactions/deposit', postExternalDeposit);

// Real-Time Webhook Subscriptions
router.post('/webhooks/subscribe', subscribeExternalWebhook);

export default router;
