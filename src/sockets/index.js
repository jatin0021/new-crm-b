import { Server as SocketIOServer } from 'socket.io';
import { attachLiveChatSocket } from './liveChatSocket.js';
import { attachMt5ManagerSocket } from './mt5ManagerSocket.js';
import { attachLpTradesSocket } from './lpTradesSocket.js';

export const initSockets = (httpServer) => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  attachLiveChatSocket(io);
  attachMt5ManagerSocket(io);
  attachLpTradesSocket(io);

  console.log('⚡ Socket.IO Servers initialized for LiveChat, MT5 Metrics & LP Risk Bridge');
  return io;
};
