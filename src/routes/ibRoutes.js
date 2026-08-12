import express from 'express';
import { getIbProfile } from '../controllers/ibController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateJWT);
router.get('/profile', getIbProfile);

export default router;
