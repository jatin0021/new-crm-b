import express from 'express';
import { registerUser, loginUser, getProfile, forgotPassword, resetPassword } from '../controllers/authController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', authenticateJWT, getProfile);

export default router;
