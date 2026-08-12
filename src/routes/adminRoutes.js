import express from 'express';
import { listAllUsers, impersonateUser, reviewDeposit, executeSafeDbQuery } from '../controllers/adminController.js';
import { authenticateJWT, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateJWT);
router.use(requireRole(['super_admin', 'desk_admin']));

router.get('/users', listAllUsers);
router.post('/impersonate', impersonateUser);
router.post('/deposits/review', reviewDeposit);
router.post('/db-browser', requireRole(['super_admin']), executeSafeDbQuery);

export default router;
