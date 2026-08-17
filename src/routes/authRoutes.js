import express from 'express';
import { 
  registerUser, 
  loginUser, 
  getProfile, 
  forgotPassword, 
  resetPassword,
  validateResetToken,
  verifyEmail,
  resendVerification,
  refreshToken,
  verifyTurnstile
} from '../controllers/authController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/validate-reset-token', validateResetToken);
router.post('/reset-password', resetPassword);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/verify-turnstile', verifyTurnstile);

// Protected Auth Routes
router.get('/me', authenticateJWT, getProfile);
router.post('/refresh-token', authenticateJWT, refreshToken);

export default router;
