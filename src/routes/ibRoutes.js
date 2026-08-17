import express from 'express';
import {
  getIbOverview,
  applyForIb,
  transferCommissionToWallet,
  listIbClients,
  getIbAnalytics
} from '../controllers/ibController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateJWT);

router.get('/overview', getIbOverview);
router.post('/apply', applyForIb);
router.post('/transfer-commission', transferCommissionToWallet);
router.get('/clients', listIbClients);
router.get('/analytics', getIbAnalytics);

export default router;
