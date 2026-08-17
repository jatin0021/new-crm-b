import express from 'express';
import { 
  listSupportTickets, 
  createSupportTicket,
  replyTicket,
  getFaqs
} from '../controllers/supportController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateJWT);

router.get('/tickets', listSupportTickets);
router.post('/tickets', createSupportTicket);
router.post('/tickets/:ticket_id/reply', replyTicket);
router.get('/faqs', getFaqs);

export default router;
