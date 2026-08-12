import express from 'express';
import { listTradingAccounts, createTradingAccount, updateLeverage, internalTransfer } from '../controllers/accountController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateJWT);

router.get('/', listTradingAccounts);
router.post('/create', createTradingAccount);
router.post('/leverage', updateLeverage);
router.post('/transfer', internalTransfer);

export default router;
