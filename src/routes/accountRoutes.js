import express from 'express';
import { 
  listTradingAccounts, 
  createTradingAccount, 
  updateLeverage, 
  internalTransfer,
  changeTradingPassword,
  getSsoToken,
  getTradePerformance,
  getCopyTradingProviders,
  followStrategyProvider
} from '../controllers/accountController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateJWT);

router.get('/', listTradingAccounts);
router.post('/create', createTradingAccount);
router.post('/leverage', updateLeverage);
router.post('/transfer', internalTransfer);
router.post('/change-password', changeTradingPassword);
router.post('/sso-token', getSsoToken);
router.get('/performance', getTradePerformance);
router.get('/copy-trading', getCopyTradingProviders);
router.post('/copy-trading/follow', followStrategyProvider);

export default router;
