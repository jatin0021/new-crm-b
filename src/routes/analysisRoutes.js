import express from 'express';
import { getEconomicCalendar, getCandleFeed } from '../controllers/analysisController.js';

const router = express.Router();

router.get('/calendar', getEconomicCalendar);
router.get('/candles/:symbol?/:tf?', getCandleFeed);

export default router;
