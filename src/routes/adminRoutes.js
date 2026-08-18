import express from 'express';
import { 
  adminLogin, 
  listAllUsers, 
  impersonateUser, 
  reviewDeposit, 
  executeSafeDbQuery,
  getExecutiveAnalytics,
  getSystemHealth,
  updateAdminProfile,
  changeAdminPassword,
  listAdminKyc,
  streamAdminKycFile,
  updateAdminKyc,
  deleteAllUsers
} from '../controllers/adminController.js';
import {
  getTerminalOverview,
  getLiveTradingAccounts,
  getAccountDetail,
  getOpenPositions,
  forceClosePosition,
  modifyPosition,
  getOpenOrders,
  cancelOrder,
  getQuoteFeed,
  getSymbolsAndSpreads,
  updateSymbolsAndSpreads,
  getMarketSessions,
  updateMarketSessions,
  getSlippageSettings,
  updateSlippageSettings,
  getRiskLimits,
  updateRiskLimits
} from '../controllers/terminalRiskController.js';
import {
  getDepositsLedgers,
  reviewDepositAction,
  getLocalDepositors,
  getWithdrawalsLedgers,
  reviewWithdrawalAction,
  getPaymentGatewaysConfig,
  updatePaymentGatewaysConfig,
  getManualGatewaysConfig,
  updateManualGatewaysConfig,
  getWithdrawalGatewaysConfig,
  updateWithdrawalGatewaysConfig,
  getUserPaymentDetails,
  verifyUserPaymentDetail,
  executeBalanceAdjustment,
  getCryptoSweepingConfig,
  updateCryptoSweepingConfig
} from '../controllers/adminFinancialController.js';
import { authenticateJWT, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Public unauthenticated login endpoint
router.post('/login', adminLogin);

// Protected admin endpoints requiring valid JWT Bearer token & role
router.use(authenticateJWT);
router.use(requireRole(['super_admin', 'desk_admin', 'finance_admin', 'compliance_admin', 'risk_admin']));

router.get('/users', listAllUsers);
router.delete('/users', requireRole(['super_admin']), deleteAllUsers);
router.post('/impersonate', impersonateUser);
router.post('/deposits/review', reviewDeposit);
router.get('/analytics/overview', getExecutiveAnalytics);
router.get('/system-health', getSystemHealth);
router.put('/profile', updateAdminProfile);
router.put('/change-password', changeAdminPassword);

// Terminal & Risk Management Endpoints (Req 11 - 22)
router.get('/terminal/overview', getTerminalOverview);
router.get('/terminal/accounts', getLiveTradingAccounts);
router.get('/terminal/account-detail/:login', getAccountDetail);
router.get('/terminal/positions', getOpenPositions);
router.post('/terminal/positions/close', forceClosePosition);
router.post('/terminal/positions/modify', modifyPosition);
router.get('/terminal/orders', getOpenOrders);
router.post('/terminal/orders/cancel', cancelOrder);
router.get('/terminal/quotes', getQuoteFeed);
router.get('/terminal/symbols', getSymbolsAndSpreads);
router.put('/terminal/symbols', updateSymbolsAndSpreads);
router.get('/terminal/market-sessions', getMarketSessions);
router.put('/terminal/market-sessions', updateMarketSessions);
router.get('/terminal/slippage-execution', getSlippageSettings);
router.put('/terminal/slippage-execution', updateSlippageSettings);
router.get('/terminal/risk-limits', getRiskLimits);
router.put('/terminal/risk-limits', updateRiskLimits);

// Financial Operations & Payment Gateways Endpoints (Req 35 - 49)
router.get('/financial-ops/deposits/ledgers', getDepositsLedgers);
router.post('/financial-ops/deposits/review', reviewDepositAction);
router.get('/financial-ops/local-depositors', getLocalDepositors);
router.get('/financial-ops/withdrawals/ledgers', getWithdrawalsLedgers);
router.post('/financial-ops/withdrawals/review', reviewWithdrawalAction);
router.get('/financial-ops/gateways/auto', getPaymentGatewaysConfig);
router.put('/financial-ops/gateways/auto', updatePaymentGatewaysConfig);
router.get('/financial-ops/gateways/manual', getManualGatewaysConfig);
router.put('/financial-ops/gateways/manual', updateManualGatewaysConfig);
router.get('/financial-ops/gateways/payouts', getWithdrawalGatewaysConfig);
router.put('/financial-ops/gateways/payouts', updateWithdrawalGatewaysConfig);
router.get('/financial-ops/user-payment-details', getUserPaymentDetails);
router.post('/financial-ops/user-payment-details/verify', verifyUserPaymentDetail);
router.post('/financial-ops/balance-adjustment', executeBalanceAdjustment);
router.get('/financial-ops/crypto-sweeping', getCryptoSweepingConfig);
router.put('/financial-ops/crypto-sweeping', updateCryptoSweepingConfig);

router.post('/db-browser', requireRole(['super_admin']), executeSafeDbQuery);

// Compliance & KYC Endpoints
router.get('/kyc', listAdminKyc);
router.get('/kyc/file', streamAdminKycFile);
router.patch('/kyc/:id', updateAdminKyc);

export default router;



