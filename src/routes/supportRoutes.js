import express from 'express';
import { listSupportTickets, createSupportTicket } from '../controllers/supportController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateJWT);
router.get('/tickets', listSupportTickets);
router.post('/tickets', createSupportTicket);

export default router;
