import express from 'express';
import { 
  listTradingAccounts, 
  getAvailableGroups,
  createTradingAccount, 
  demoTopUp,
  updateLeverage, 
  internalTransfer,
  changeTradingPassword,
  getSsoToken,
  getTradePerformance,
  getCopyTradingProviders,
  followStrategyProvider
} from '../controllers/accountController.js';
import { authenticateJWT } from '../middleware/auth.js';
import { requireKycUnlessDemo } from '../middleware/kycMiddleware.js';

const router = express.Router();

router.use(authenticateJWT);

router.get('/', listTradingAccounts);
router.get('/available-groups', getAvailableGroups);
router.post('/', requireKycUnlessDemo, createTradingAccount);
router.post('/create', requireKycUnlessDemo, createTradingAccount);
router.post('/demo-topup', demoTopUp);
router.post('/change-password', changeTradingPassword);
router.post('/leverage', updateLeverage);
router.post('/transfer', internalTransfer);
router.get('/sso-token', getSsoToken);
router.post('/sso-token', getSsoToken);
router.get('/performance', getTradePerformance);
router.get('/copy-trading', getCopyTradingProviders);
router.post('/copy-trading/follow', followStrategyProvider);

export default router;
