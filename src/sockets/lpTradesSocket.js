/**
 * Socket.IO Handler for Liquidity Provider (LP) Risk Execution Feed
 * Blueprint Section 2.2: Connects admin risk management console with LP FIX bridge
 */
export const attachLpTradesSocket = (io) => {
  const lpNamespace = io.of('/lp-risk');

  lpNamespace.on('connection', (socket) => {
    console.log(`🛡️ LP Risk Bridge Socket Connected: ${socket.id}`);

    socket.on('join_risk_console', () => {
      socket.join('admin_risk_monitors');
    });

    socket.on('disconnect', () => {
      console.log(`🛡️ LP Risk Bridge Socket Disconnected: ${socket.id}`);
    });
  });
};
