import express from 'express';
import { handleCregisWebhook, handleJexipayWebhook, handleShuftiKycWebhook } from '../controllers/webhookController.js';

const router = express.Router();

router.post('/cregis', handleCregisWebhook);
router.post('/jexipay', handleJexipayWebhook);
router.post('/shufti', handleShuftiKycWebhook);

export default router;
