export const getEconomicCalendar = async (req, res) => {
  const calendarEvents = [
    { id: 1, title: 'US Non-Farm Payrolls (NFP)', time: '13:30 GMT', country: 'USD', impact: 'HIGH', forecast: '185K', previous: '175K', actual: '192K' },
    { id: 2, title: 'US Consumer Price Index (CPI YoY)', time: '13:30 GMT', country: 'USD', impact: 'HIGH', forecast: '3.1%', previous: '3.3%', actual: '3.0%' },
    { id: 3, title: 'ECB Interest Rate Decision', time: '12:15 GMT', country: 'EUR', impact: 'HIGH', forecast: '3.75%', previous: '4.00%', actual: '3.75%' },
    { id: 4, title: 'UK Retail Sales (MoM)', time: '07:00 GMT', country: 'GBP', impact: 'MEDIUM', forecast: '0.4%', previous: '-0.2%', actual: '0.5%' },
    { id: 5, title: 'Japan National CPI (YoY)', time: '23:30 GMT', country: 'JPY', impact: 'MEDIUM', forecast: '2.8%', previous: '2.8%', actual: '2.8%' }
  ];

  return res.json({
    message: 'Economic calendar events fetched',
    data: { calendar: calendarEvents }
  });
};

export const getTechnicalInsights = async (req, res) => {
  const insights = [
    {
      symbol: 'EURUSD',
      name: 'Euro / US Dollar',
      timeframe: 'H4',
      conviction_bullish: 78,
      conviction_bearish: 22,
      trend: 'Bullish Continuation',
      pattern: 'Ascending Triangle Breakout',
      support: 1.0850,
      resistance: 1.0920,
      target: 1.0980,
      indicators: {
        rsi: { value: 62.4, status: 'Bullish' },
        macd: { value: '0.0014 (Crossover)', status: 'Bullish' },
        stochastic: { value: '74.2 / 68.5', status: 'Neutral' },
        bollinger: { value: 'Expanding Width', status: 'Volatile' },
        ema20_50: { value: 'EMA 20 > EMA 50', status: 'Golden Cross' },
        supertrend: { value: '1.0835 Green Line', status: 'Buy Signal' }
      }
    },
    {
      symbol: 'XAUUSD',
      name: 'Gold / US Dollar',
      timeframe: 'D1',
      conviction_bullish: 84,
      conviction_bearish: 16,
      trend: 'Strong Uptrend',
      pattern: 'Cup & Handle Accumulation',
      support: 2420.00,
      resistance: 2480.00,
      target: 2520.00,
      indicators: {
        rsi: { value: 68.1, status: 'Strong Bullish' },
        macd: { value: '12.4 (Expanding)', status: 'Bullish' },
        stochastic: { value: '82.0 (Overbought)', status: 'Bullish' },
        bollinger: { value: 'Upper Band Touch', status: 'High Momentum' },
        ema20_50: { value: 'EMA 20 > EMA 200', status: 'Bullish' },
        supertrend: { value: '2410.00 Green', status: 'Buy Signal' }
      }
    },
    {
      symbol: 'BTCUSD',
      name: 'Bitcoin / US Dollar',
      timeframe: 'H1',
      conviction_bullish: 45,
      conviction_bearish: 55,
      trend: 'Bearish Correction',
      pattern: 'Double Top Rejection',
      support: 58500.00,
      resistance: 62000.00,
      target: 56200.00,
      indicators: {
        rsi: { value: 41.2, status: 'Bearish' },
        macd: { value: '-120.5 (Divergence)', status: 'Bearish' },
        stochastic: { value: '32.1', status: 'Bearish' },
        bollinger: { value: 'Lower Band Contraction', status: 'Consolidating' },
        ema20_50: { value: 'EMA 20 < EMA 50', status: 'Death Cross' },
        supertrend: { value: '61200 Red Line', status: 'Sell Signal' }
      }
    }
  ];

  return res.json({
    message: 'Technical insights & multi-indicator readings fetched',
    data: { insights }
  });
};

export const getNewsStream = async (req, res) => {
  const news = [
    { id: 101, category: 'Forex', title: 'ECB Signals Interest Rate Cut as Eurozone Inflation Cools to Target', time: '10 Mins Ago', source: 'Reuters Financial' },
    { id: 102, category: 'Crypto', title: 'Bitcoin Rebounds Above $60,000 as Institutional ETF Inflows Resume', time: '25 Mins Ago', source: 'CoinDesk Macro' },
    { id: 103, category: 'Commodities', title: 'Gold Surges Near All-Time Highs Amid Central Bank Accumulation', time: '1 Hour Ago', source: 'Bloomberg Markets' },
    { id: 104, category: 'Indices', title: 'S&P 500 and Nasdaq Reach New Highs Driven by Big Tech Earnings', time: '2 Hours Ago', source: 'Financial Times' }
  ];

  return res.json({
    message: 'Live market news stream fetched',
    data: { news }
  });
};

export const getCandleFeed = async (req, res) => {
  const { symbol, tf } = req.params;
  const pair = symbol ? symbol.toUpperCase() : 'EURUSD';
  
  const candles = [];
  let basePrice = pair.includes('XAU') ? 2450.00 : pair.includes('BTC') ? 60000.00 : 1.0880;

  for (let i = 0; i < 30; i++) {
    const open = basePrice + (Math.random() - 0.5) * (pair.includes('BTC') ? 200 : 0.0040);
    const high = open + Math.random() * (pair.includes('BTC') ? 150 : 0.0030);
    const low = open - Math.random() * (pair.includes('BTC') ? 150 : 0.0030);
    const close = (high + low) / 2;
    basePrice = close;

    candles.push({
      time: Math.floor(Date.now() / 1000) - (30 - i) * 3600,
      open: parseFloat(open.toFixed(pair.includes('BTC') ? 2 : 5)),
      high: parseFloat(high.toFixed(pair.includes('BTC') ? 2 : 5)),
      low: parseFloat(low.toFixed(pair.includes('BTC') ? 2 : 5)),
      close: parseFloat(close.toFixed(pair.includes('BTC') ? 2 : 5)),
      volume: Math.floor(Math.random() * 500 + 100)
    });
  }

  return res.json({
    message: `Candlestick feed for ${pair} [${tf || 'H1'}]`,
    data: { symbol: pair, timeframe: tf || 'H1', candles }
  });
};
