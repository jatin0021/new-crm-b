import { query, checkPgStatus, inMemoryStore } from '../config/db.js';

// In-Memory store for terminal telemetry & risk configurations
let inMemorySymbols = [
  { symbol: 'EURUSD', name: 'Euro / US Dollar', category: 'Forex Major', bid: 1.08452, ask: 1.08464, spreadPoints: 12, markupStandard: 1.2, markupEcn: 0.2, markupVip: 0.0, digit: 5 },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar', category: 'Forex Major', bid: 1.29410, ask: 1.29426, spreadPoints: 16, markupStandard: 1.5, markupEcn: 0.3, markupVip: 0.0, digit: 5 },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', category: 'Forex Major', bid: 154.210, ask: 154.225, spreadPoints: 15, markupStandard: 1.5, markupEcn: 0.3, markupVip: 0.0, digit: 3 },
  { symbol: 'XAUUSD', name: 'Gold / US Dollar', category: 'Commodities', bid: 2420.50, ask: 2420.80, spreadPoints: 30, markupStandard: 3.5, markupEcn: 1.0, markupVip: 0.5, digit: 2 },
  { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar', category: 'Crypto', bid: 64200.00, ask: 64235.00, spreadPoints: 3500, markupStandard: 35.0, markupEcn: 10.0, markupVip: 5.0, digit: 2 },
  { symbol: 'US30', name: 'Dow Jones Industrial 30', category: 'Indices', bid: 40850.00, ask: 40854.00, spreadPoints: 400, markupStandard: 4.0, markupEcn: 1.0, markupVip: 0.5, digit: 1 }
];

let inMemoryPositions = [
  { ticket: 900101, login: 501928, trader: 'John Doe', symbol: 'XAUUSD', type: 'BUY', volume: 2.50, open_price: 2415.20, current_price: 2420.50, sl: 2400.00, tp: 2440.00, swap: -12.40, profit: 1325.00, open_time: '2026-08-17 14:20:10' },
  { ticket: 900102, login: 501929, trader: 'Alex Smith', symbol: 'EURUSD', type: 'SELL', volume: 5.00, open_price: 1.08800, current_price: 1.08452, sl: 1.09200, tp: 1.08000, swap: -5.10, profit: 1740.00, open_time: '2026-08-17 15:05:44' },
  { ticket: 900103, login: 501930, trader: 'Maria Garcia', symbol: 'BTCUSD', type: 'BUY', volume: 0.50, open_price: 63800.00, current_price: 64200.00, sl: 62000.00, tp: 66000.00, swap: -8.00, profit: 200.00, open_time: '2026-08-17 16:12:00' },
  { ticket: 900104, login: 501931, trader: 'David FX', symbol: 'GBPUSD', type: 'BUY', volume: 10.00, open_price: 1.29800, current_price: 1.29410, sl: 1.29000, tp: 1.30500, swap: -15.00, profit: -3900.00, open_time: '2026-08-17 17:00:22' },
  { ticket: 900105, login: 501932, trader: 'Chen Wei', symbol: 'US30', type: 'SELL', volume: 1.00, open_price: 40600.00, current_price: 40850.00, sl: 41000.00, tp: 40000.00, swap: 0.00, profit: -250.00, open_time: '2026-08-17 18:40:05' }
];

let inMemoryOrders = [
  { ticket: 950201, login: 501928, trader: 'John Doe', symbol: 'XAUUSD', type: 'BUY LIMIT', volume: 1.00, target_price: 2400.00, current_price: 2420.50, sl: 2380.00, tp: 2450.00, status: 'pending', created_at: '2026-08-17 18:00:00' },
  { ticket: 950202, login: 501929, trader: 'Alex Smith', symbol: 'EURUSD', type: 'SELL LIMIT', volume: 3.00, target_price: 1.09000, current_price: 1.08452, sl: 1.09400, tp: 1.08200, status: 'pending', created_at: '2026-08-17 18:30:00' },
  { ticket: 950203, login: 501930, trader: 'Maria Garcia', symbol: 'BTCUSD', type: 'BUY STOP', volume: 0.25, target_price: 65000.00, current_price: 64200.00, sl: 63000.00, tp: 68000.00, status: 'pending', created_at: '2026-08-17 19:15:00' }
];

let inMemorySessions = [
  { day: 'Monday', isOpen: true, openTime: '00:00', closeTime: '23:59', breakStart: '17:00', breakEnd: '17:05' },
  { day: 'Tuesday', isOpen: true, openTime: '00:00', closeTime: '23:59', breakStart: '17:00', breakEnd: '17:05' },
  { day: 'Wednesday', isOpen: true, openTime: '00:00', closeTime: '23:59', breakStart: '17:00', breakEnd: '17:05' },
  { day: 'Thursday', isOpen: true, openTime: '00:00', closeTime: '23:59', breakStart: '17:00', breakEnd: '17:05' },
  { day: 'Friday', isOpen: true, openTime: '00:00', closeTime: '23:00', breakStart: '17:00', breakEnd: '17:05' },
  { day: 'Saturday', isOpen: false, openTime: '00:00', closeTime: '00:00', breakStart: '-', breakEnd: '-' },
  { day: 'Sunday', isOpen: true, openTime: '23:00', closeTime: '23:59', breakStart: '-', breakEnd: '-' }
];

let inMemoryHolidays = [
  { id: 1, name: 'New Year Day', date: '2026-01-01', symbols: 'All Symbols', status: 'Closed' },
  { id: 2, name: 'US Independence Day', date: '2026-07-04', symbols: 'US30, XAUUSD', status: 'Early Close (13:00)' },
  { id: 3, name: 'Christmas Day', date: '2026-12-25', symbols: 'All Symbols', status: 'Closed' }
];

let inMemorySlippage = {
  globalTolerancePoints: 20,
  executionDelayMs: 45,
  maxPriceDeviationPoints: 50,
  groups: [
    { group: 'Standard ECN', maxSlippagePoints: 15, delayMs: 30, deviationLimitPoints: 40 },
    { group: 'VIP Institutional', maxSlippagePoints: 5, delayMs: 10, deviationLimitPoints: 20 },
    { group: 'Crypto 24/7', maxSlippagePoints: 50, delayMs: 80, deviationLimitPoints: 100 }
  ]
};

let inMemoryRiskLimits = {
  maxOpenLotsPerAccount: 50.0,
  maxOpenTicketsPerAccount: 20,
  maxLeverage: '1:500',
  marginCallPercent: 100.0,
  stopOutPercent: 50.0,
  negativeBalanceProtection: true,
  allowWeekendHolding: true
};

/**
 * 11. Terminal Live Telemetry Dashboard & Online Counter
 */
export const getTerminalOverview = async (req, res) => {
  try {
    const totalOpenLots = inMemoryPositions.reduce((acc, p) => acc + p.volume, 0);
    const activeTickets = inMemoryPositions.length;
    const aggregateFloatingPnl = inMemoryPositions.reduce((acc, p) => acc + p.profit, 0);

    const onlineTraders = [
      { id: 1, login: 501928, name: 'John Doe', ip: '192.168.1.45', location: 'United States', terminal: 'MT5 Desktop', activeSymbol: 'XAUUSD', pingMs: 12 },
      { id: 2, login: 501929, name: 'Alex Smith', ip: '86.12.90.11', location: 'United Kingdom', terminal: 'WebTrader', activeSymbol: 'EURUSD', pingMs: 24 },
      { id: 3, login: 501930, name: 'Maria Garcia', ip: '217.14.8.4', location: 'Spain', terminal: 'iOS Mobile', activeSymbol: 'BTCUSD', pingMs: 18 },
      { id: 4, login: 501931, name: 'David FX', ip: '92.112.5.80', location: 'Germany', terminal: 'Android Mobile', activeSymbol: 'GBPUSD', pingMs: 15 },
      { id: 5, login: 501932, name: 'Chen Wei', ip: '118.200.4.9', location: 'Singapore', terminal: 'WebTrader', activeSymbol: 'US30', pingMs: 32 }
    ];

    return res.json({
      message: 'Terminal live telemetry retrieved',
      data: {
        serverLatencyMs: 1.2,
        serverStatus: 'Optimal (0 lost packets)',
        totalOpenLots: parseFloat(totalOpenLots.toFixed(2)),
        activeTicketsCount: activeTickets,
        aggregateFloatingPnl: parseFloat(aggregateFloatingPnl.toFixed(2)),
        onlineTradersCount: onlineTraders.length,
        onlineTradersList: onlineTraders
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve terminal overview', error: err.message });
  }
};

/**
 * 12. Live Trading Accounts Monitor Table
 */
export const getLiveTradingAccounts = async (req, res) => {
  try {
    let accounts = [];
    if (checkPgStatus()) {
      const resVal = await query(`SELECT t.*, u.first_name, u.last_name, u.email FROM trading_accounts t LEFT JOIN users u ON t.user_id = u.id ORDER BY t.id DESC`);
      accounts = resVal.rows.map(a => {
        const bal = parseFloat(a.balance || 0);
        const eq = parseFloat(a.equity || bal);
        const freeMarg = parseFloat(a.free_margin || eq);
        const marginUsed = Math.max(0, eq - freeMarg);
        const marginLevel = marginUsed > 0 ? parseFloat(((eq / marginUsed) * 100).toFixed(2)) : 9999.99;
        return {
          id: a.id,
          login: a.login,
          trader: `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email || 'Trader User',
          email: a.email,
          account_type: a.account_type,
          group_type: a.group_type || 'Standard ECN',
          leverage: a.leverage || '1:500',
          balance: bal,
          equity: eq,
          margin_used: marginUsed,
          free_margin: freeMarg,
          margin_level_pct: marginLevel,
          floating_pnl: parseFloat((eq - bal).toFixed(2)),
          currency: a.currency || 'USD',
          server: a.account_type === 'demo' ? 'VintageDemo-Server 1' : 'VintageLive-Server 1'
        };
      });
    } else {
      accounts = [
        { id: 1, login: 501928, trader: 'John Doe', email: 'trader@example.com', account_type: 'live', group_type: 'Standard ECN', leverage: '1:500', balance: 15000.00, equity: 16325.00, margin_used: 1200.00, free_margin: 15125.00, margin_level_pct: 1360.4, floating_pnl: 1325.00, currency: 'USD', server: 'VintageLive-Server 1' },
        { id: 2, login: 501929, trader: 'Alex Smith', email: 'alex.trader@example.com', account_type: 'live', group_type: 'VIP ECN', leverage: '1:200', balance: 5000.00, equity: 6740.00, margin_used: 800.00, free_margin: 5940.00, margin_level_pct: 842.5, floating_pnl: 1740.00, currency: 'USD', server: 'VintageLive-Server 1' },
        { id: 3, login: 501930, trader: 'Maria Garcia', email: 'maria.investor@example.com', account_type: 'live', group_type: 'Crypto 24/7', leverage: '1:100', balance: 32000.00, equity: 32200.00, margin_used: 1500.00, free_margin: 30700.00, margin_level_pct: 2146.6, floating_pnl: 200.00, currency: 'USD', server: 'VintageLive-Server 1' },
        { id: 4, login: 501931, trader: 'David FX', email: 'david.fx@example.com', account_type: 'live', group_type: 'Standard ECN', leverage: '1:500', balance: 10000.00, equity: 6100.00, margin_used: 4200.00, free_margin: 1900.00, margin_level_pct: 145.2, floating_pnl: -3900.00, currency: 'USD', server: 'VintageLive-Server 1' },
        { id: 5, login: 501932, trader: 'Chen Wei', email: 'chen.wei@example.com', account_type: 'demo', group_type: 'Demo Standard', leverage: '1:100', balance: 10000.00, equity: 9750.00, margin_used: 500.00, free_margin: 9250.00, margin_level_pct: 1950.0, floating_pnl: -250.00, currency: 'USD', server: 'VintageDemo-Server 1' }
      ];
    }

    return res.json({
      message: 'Live trading accounts monitor data retrieved',
      data: { accounts }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve live trading accounts', error: err.message });
  }
};

/**
 * 13. Account Profile Inspection Modal Data
 */
export const getAccountDetail = async (req, res) => {
  const { login } = req.params;

  try {
    const loginNum = parseInt(login);
    const openPositions = inMemoryPositions.filter(p => p.login === loginNum);
    const closedHistory = [
      { ticket: 800101, symbol: 'EURUSD', type: 'BUY', volume: 2.00, open_price: 1.08200, close_price: 1.08650, profit: 900.00, close_time: '2026-08-16 18:20:00' },
      { ticket: 800102, symbol: 'XAUUSD', type: 'SELL', volume: 1.00, open_price: 2430.00, close_price: 2418.00, profit: 1200.00, close_time: '2026-08-16 19:45:10' }
    ];

    return res.json({
      message: `Account details fetched for #${login}`,
      data: {
        login: loginNum,
        trader: 'John Doe',
        email: 'trader@example.com',
        account_type: 'live',
        group_type: 'Standard ECN',
        leverage: '1:500',
        balance: 15000.00,
        equity: 16325.00,
        open_positions: openPositions,
        closed_history: closedHistory
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to inspect account detail', error: err.message });
  }
};

/**
 * 14. Live Open Positions Grid
 */
export const getOpenPositions = async (req, res) => {
  try {
    return res.json({
      message: 'Live open positions retrieved',
      data: { positions: inMemoryPositions }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve open positions', error: err.message });
  }
};

/**
 * 15. Emergency Force Close Position Override
 */
export const forceClosePosition = async (req, res) => {
  const { ticket, admin_notes } = req.body;

  if (!ticket) {
    return res.status(400).json({ message: 'Position ticket number is required' });
  }

  try {
    const ticketNum = parseInt(ticket);
    const index = inMemoryPositions.findIndex(p => p.ticket === ticketNum);

    let closedPosition = null;
    if (index !== -1) {
      closedPosition = inMemoryPositions[index];
      inMemoryPositions.splice(index, 1);
    }

    return res.json({
      message: `Emergency Force Close Override executed for Ticket #${ticket}`,
      data: {
        ticket: ticketNum,
        closed_at_price: closedPosition ? closedPosition.current_price : 0,
        realized_pnl: closedPosition ? closedPosition.profit : 0,
        admin_notes: admin_notes || 'Emergency Admin Liquidate Override'
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Force close override failed', error: err.message });
  }
};

/**
 * Modify Position SL/TP
 */
export const modifyPosition = async (req, res) => {
  const { ticket, sl, tp } = req.body;

  try {
    const pos = inMemoryPositions.find(p => p.ticket === parseInt(ticket));
    if (pos) {
      if (sl !== undefined) pos.sl = parseFloat(sl);
      if (tp !== undefined) pos.tp = parseFloat(tp);
    }

    return res.json({
      message: `Position #${ticket} modified successfully (SL: ${sl}, TP: ${tp})`,
      data: { ticket, sl, tp }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Position modification failed', error: err.message });
  }
};

/**
 * 16. Live Open Orders & Limits Monitor
 */
export const getOpenOrders = async (req, res) => {
  try {
    return res.json({
      message: 'Pending open orders & limits retrieved',
      data: { orders: inMemoryOrders }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve open orders', error: err.message });
  }
};

export const cancelOrder = async (req, res) => {
  const { ticket } = req.body;

  try {
    const ticketNum = parseInt(ticket);
    inMemoryOrders = inMemoryOrders.filter(o => o.ticket !== ticketNum);

    return res.json({
      message: `Pending Order #${ticket} cancelled successfully`,
      data: { ticket: ticketNum }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Order cancellation failed', error: err.message });
  }
};

/**
 * 18. Live Quote Chart Feed Widget Data
 */
export const getQuoteFeed = async (req, res) => {
  try {
    const symbolQuotes = inMemorySymbols.map(s => ({
      ...s,
      timestamp: new Date().toISOString(),
      latencyMs: 1.2
    }));

    return res.json({
      message: 'Real-time symbol quote feeds retrieved',
      data: { quotes: symbolQuotes }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Quote feed retrieval failed', error: err.message });
  }
};

/**
 * 19. Dynamic Symbol & Spread Configuration
 */
export const getSymbolsAndSpreads = async (req, res) => {
  try {
    return res.json({
      message: 'Symbols & spread markup configurations retrieved',
      data: { symbols: inMemorySymbols }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch symbols', error: err.message });
  }
};

export const updateSymbolsAndSpreads = async (req, res) => {
  const { symbol, markupStandard, markupEcn, markupVip } = req.body;

  try {
    const target = inMemorySymbols.find(s => s.symbol === symbol);
    if (target) {
      if (markupStandard !== undefined) target.markupStandard = parseFloat(markupStandard);
      if (markupEcn !== undefined) target.markupEcn = parseFloat(markupEcn);
      if (markupVip !== undefined) target.markupVip = parseFloat(markupVip);
    }

    return res.json({
      message: `Spread markup settings updated for symbol ${symbol}`,
      data: { symbol, markupStandard, markupEcn, markupVip }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update symbol spreads', error: err.message });
  }
};

/**
 * 20. Market Sessions & Trading Hours Editor
 */
export const getMarketSessions = async (req, res) => {
  try {
    return res.json({
      message: 'Market trading sessions & holiday schedules fetched',
      data: {
        weeklySessions: inMemorySessions,
        holidays: inMemoryHolidays
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch market sessions', error: err.message });
  }
};

export const updateMarketSessions = async (req, res) => {
  const { weeklySessions, holidays } = req.body;

  try {
    if (weeklySessions) inMemorySessions = weeklySessions;
    if (holidays) inMemoryHolidays = holidays;

    return res.json({
      message: 'Market sessions and trading schedule updated successfully',
      data: { weeklySessions: inMemorySessions, holidays: inMemoryHolidays }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update market sessions', error: err.message });
  }
};

/**
 * 21. Slippage & Execution Settings
 */
export const getSlippageSettings = async (req, res) => {
  try {
    return res.json({
      message: 'Slippage and execution settings fetched',
      data: { slippage: inMemorySlippage }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch slippage settings', error: err.message });
  }
};

export const updateSlippageSettings = async (req, res) => {
  const { globalTolerancePoints, executionDelayMs, maxPriceDeviationPoints, groups } = req.body;

  try {
    if (globalTolerancePoints !== undefined) inMemorySlippage.globalTolerancePoints = parseInt(globalTolerancePoints);
    if (executionDelayMs !== undefined) inMemorySlippage.executionDelayMs = parseInt(executionDelayMs);
    if (maxPriceDeviationPoints !== undefined) inMemorySlippage.maxPriceDeviationPoints = parseInt(maxPriceDeviationPoints);
    if (groups) inMemorySlippage.groups = groups;

    return res.json({
      message: 'Slippage & execution parameters updated successfully',
      data: { slippage: inMemorySlippage }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update slippage settings', error: err.message });
  }
};

/**
 * 22. Account Exposure & Risk Limits
 */
export const getRiskLimits = async (req, res) => {
  try {
    return res.json({
      message: 'Account risk exposure limits fetched',
      data: { riskLimits: inMemoryRiskLimits }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch risk limits', error: err.message });
  }
};

export const updateRiskLimits = async (req, res) => {
  const { maxOpenLotsPerAccount, maxOpenTicketsPerAccount, maxLeverage, marginCallPercent, stopOutPercent, negativeBalanceProtection, allowWeekendHolding } = req.body;

  try {
    if (maxOpenLotsPerAccount !== undefined) inMemoryRiskLimits.maxOpenLotsPerAccount = parseFloat(maxOpenLotsPerAccount);
    if (maxOpenTicketsPerAccount !== undefined) inMemoryRiskLimits.maxOpenTicketsPerAccount = parseInt(maxOpenTicketsPerAccount);
    if (maxLeverage !== undefined) inMemoryRiskLimits.maxLeverage = maxLeverage;
    if (marginCallPercent !== undefined) inMemoryRiskLimits.marginCallPercent = parseFloat(marginCallPercent);
    if (stopOutPercent !== undefined) inMemoryRiskLimits.stopOutPercent = parseFloat(stopOutPercent);
    if (negativeBalanceProtection !== undefined) inMemoryRiskLimits.negativeBalanceProtection = Boolean(negativeBalanceProtection);
    if (allowWeekendHolding !== undefined) inMemoryRiskLimits.allowWeekendHolding = Boolean(allowWeekendHolding);

    return res.json({
      message: 'Account risk exposure limits updated successfully',
      data: { riskLimits: inMemoryRiskLimits }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update risk limits', error: err.message });
  }
};
