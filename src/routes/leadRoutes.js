import express from 'express';
import { listLeads, createLead } from '../controllers/leadController.js';
import { authenticateJWT, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateJWT);
router.get('/', requireRole(['super_admin', 'desk_admin']), listLeads);
router.post('/', requireRole(['super_admin', 'desk_admin']), createLead);

export default router;
