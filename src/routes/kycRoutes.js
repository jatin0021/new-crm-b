import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getKycStatus, uploadKycDocuments, getSumsubToken } from '../controllers/kycController.js';
import { authenticateJWT } from '../middleware/auth.js';

// Ensure uploads/kyc directory exists
const kycUploadDir = path.join(process.cwd(), 'uploads/kyc');
try {
  if (!fs.existsSync(kycUploadDir)) {
    fs.mkdirSync(kycUploadDir, { recursive: true });
  }
} catch (e) {
  console.warn('KYC directory creation warning:', e.message);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, kycUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `kyc-${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage, 
  limits: { fileSize: 20 * 1024 * 1024 } 
});

const router = express.Router();

router.use(authenticateJWT);

router.get('/status', getKycStatus);
router.post('/sumsub-token', getSumsubToken);
router.post('/upload', upload.any(), uploadKycDocuments);

export default router;
