/**
 * Socket.IO Handler for Real-Time MT5 Account Metrics Streaming
 * Blueprint Section 2.2: Streams equity, balance, free margin & PnL updates to user dashboards
 */
export const attachMt5ManagerSocket = (io) => {
  const mt5Namespace = io.of('/mt5-metrics');

  mt5Namespace.on('connection', (socket) => {
    console.log(`📈 MT5 Metrics Socket Connected: ${socket.id}`);

    socket.on('subscribe_account', (data) => {
      const login = data.login;
      socket.join(`account_${login}`);
      console.log(`Socket ${socket.id} subscribed to MT5 Account updates #${login}`);
    });

    // Simulate periodic live tick updates for subscribed MT5 accounts
    const intervalId = setInterval(() => {
      const simulatedPnL = (Math.random() - 0.45) * 150.0;
      socket.emit('account_metrics_update', {
        timestamp: Date.now(),
        floating_pnl: parseFloat(simulatedPnL.toFixed(2)),
        equity_delta: parseFloat(simulatedPnL.toFixed(2))
      });
    }, 3000);

    socket.on('disconnect', () => {
      clearInterval(intervalId);
      console.log(`📈 MT5 Metrics Socket Disconnected: ${socket.id}`);
    });
  });
};
