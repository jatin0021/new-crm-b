export const getEconomicCalendar = async (req, res) => {
  const calendarEvents = [
    { id: 1, title: 'US Non-Farm Payrolls (NFP)', time: '13:30 GMT', impact: 'HIGH', forecast: '185K', previous: '175K' },
    { id: 2, title: 'US Consumer Price Index (CPI YoY)', time: '13:30 GMT', impact: 'HIGH', forecast: '3.1%', previous: '3.3%' },
    { id: 3, title: 'ECB Rate Decision', time: '12:15 GMT', impact: 'HIGH', forecast: '3.75%', previous: '4.00%' },
    { id: 4, title: 'UK Retail Sales (MoM)', time: '07:00 GMT', impact: 'MEDIUM', forecast: '0.4%', previous: '-0.2%' }
  ];

  return res.json({
    message: 'Economic calendar events fetched',
    data: { calendar: calendarEvents }
  });
};

export const getCandleFeed = async (req, res) => {
  const { symbol, tf } = req.params;
  const pair = symbol ? symbol.toUpperCase() : 'EURUSD';
  
  // Generate realistic dummy candlestick data for widgets
  const candles = [];
  let basePrice = pair.includes('XAU') ? 2450.00 : 1.0880;

  for (let i = 0; i < 30; i++) {
    const open = basePrice + (Math.random() - 0.5) * 0.0040;
    const high = open + Math.random() * 0.0030;
    const low = open - Math.random() * 0.0030;
    const close = (high + low) / 2;
    basePrice = close;

    candles.push({
      time: Math.floor(Date.now() / 1000) - (30 - i) * 3600,
      open: parseFloat(open.toFixed(5)),
      high: parseFloat(high.toFixed(5)),
      low: parseFloat(low.toFixed(5)),
      close: parseFloat(close.toFixed(5)),
      volume: Math.floor(Math.random() * 500 + 100)
    });
  }

  return res.json({
    message: `Candlestick feed for ${pair} [${tf || 'H1'}]`,
    data: { symbol: pair, timeframe: tf || 'H1', candles }
  });
};
