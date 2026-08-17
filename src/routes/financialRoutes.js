import express from 'express';
import multer from 'multer';
import path from 'path';
import { 
  getWallet, 
  listDeposits, 
  requestDeposit, 
  requestWithdrawal,
  cancelWithdrawal,
  listWithdrawals,
  executeInternalTransfer,
  getInternalTransfersHistory,
  initiateCregisPayment,
  checkCregisStatus,
  getAddressBook,
  saveAddressBook
} from '../controllers/financialController.js';
import { authenticateJWT } from '../middleware/auth.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads/deposits'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `deposit-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

const router = express.Router();

router.use(authenticateJWT);

router.get('/wallet', getWallet);
router.get('/deposits', listDeposits);
router.post('/deposits', upload.single('proof_file'), requestDeposit);

router.get('/withdrawals', listWithdrawals);
router.post('/withdrawals', requestWithdrawal);
router.post('/withdrawals/cancel', cancelWithdrawal);

router.post('/internal-transfer', executeInternalTransfer);
router.get('/internal-transfers', getInternalTransfersHistory);
router.post('/cregis-checkout', initiateCregisPayment);
router.get('/cregis-status/:invoice_id', checkCregisStatus);

router.get('/address-book', getAddressBook);
router.post('/address-book', saveAddressBook);

export default router;
