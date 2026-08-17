import express from 'express';
import { 
  getProfileDetails, 
  updateProfileDetails, 
  setup2FA, 
  verify2FA, 
  disable2FA, 
  changePassword, 
  getActiveSessions, 
  revokeSession 
} from '../controllers/userController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

// Protected User Routes (Require JWT authentication)
router.use(authenticateJWT);

router.get('/profile', getProfileDetails);
router.put('/profile', updateProfileDetails);

router.post('/2fa/setup', setup2FA);
router.post('/2fa/verify', verify2FA);
router.post('/2fa/disable', disable2FA);

router.post('/change-password', changePassword);

router.get('/sessions', getActiveSessions);
router.delete('/sessions', revokeSession);

export default router;
