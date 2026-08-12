import express from 'express';
import multer from 'multer';
import path from 'path';
import { getKycStatus, uploadKycDocuments } from '../controllers/kycController.js';
import { authenticateJWT } from '../middleware/auth.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads/kyc'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `kyc-${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = express.Router();

router.use(authenticateJWT);

router.get('/status', getKycStatus);
router.post('/upload', upload.fields([
  { name: 'id_document', maxCount: 1 },
  { name: 'proof_address', maxCount: 1 }
]), uploadKycDocuments);

export default router;
