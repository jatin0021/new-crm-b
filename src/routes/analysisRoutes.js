import express from 'express';
import { 
  getEconomicCalendar, 
  getCandleFeed,
  getTechnicalInsights,
  getNewsStream
} from '../controllers/analysisController.js';

const router = express.Router();

router.get('/calendar', getEconomicCalendar);
router.get('/insights', getTechnicalInsights);
router.get('/news', getNewsStream);
router.get('/candles/:symbol?/:tf?', getCandleFeed);

export default router;
