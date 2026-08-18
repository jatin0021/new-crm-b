import express from 'express';
import { adminLogin, listAllUsers, impersonateUser, reviewDeposit, executeSafeDbQuery, deleteAllUsers } from '../controllers/adminController.js';
import { authenticateJWT, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Public unauthenticated login endpoint
router.post('/login', adminLogin);

// Protected admin endpoints requiring valid JWT Bearer token & role
router.use(authenticateJWT);
router.use(requireRole(['super_admin', 'desk_admin']));

router.get('/users', listAllUsers);
router.delete('/users', requireRole(['super_admin']), deleteAllUsers);
router.post('/impersonate', impersonateUser);
router.post('/deposits/review', reviewDeposit);
router.post('/db-browser', requireRole(['super_admin']), executeSafeDbQuery);

export default router;
