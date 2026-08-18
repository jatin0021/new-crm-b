import express from 'express';
import multer from 'multer';
import path from 'path';
import { 
  getKycStatus, 
  uploadKycDocument, 
  streamKycDocument,
  startShuftiSession, 
  handleShuftiWebhook 
} from '../controllers/kycController.js';
import { authenticateJWT } from '../middleware/auth.js';

import fs from 'fs';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'uploads/kyc');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `kyc-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage, 
  limits: { fileSize: 15 * 1024 * 1024 } // Allow image/pdf up to 15MB
});

const router = express.Router();

// Public webhook callback
router.post('/shufti/webhook', express.json(), handleShuftiWebhook);

// Authenticated client routes
router.use(authenticateJWT);

router.get('/status', getKycStatus);
router.post('/upload', upload.any(), uploadKycDocument);
router.get('/documents/:id', streamKycDocument);
router.post('/shufti/start', startShuftiSession);

export default router;
