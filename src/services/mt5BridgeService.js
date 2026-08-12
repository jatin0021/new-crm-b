import * as signalR from '@microsoft/signalr';
import { env } from '../config/env.js';

export const connectMt5Bridge = async () => {
  try {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(env.MT5_BRIDGE_URL)
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: () => 30000 // Retry quietly every 30 seconds
      })
      .configureLogging(signalR.LogLevel.None) // Silence verbose internal SignalR transport logs
      .build();

    connection.on('ManagerAllClientsOverviewDelta', (delta) => {
      console.log('📡 SignalR Inbound Event: MT5 Account Delta received', delta);
    });

    connection.on('PositionAdded', (position) => {
      console.log('⚡ SignalR Inbound Event: MT5 Position Added', position);
    });

    connection.on('PositionRemoved', (position) => {
      console.log('🏁 SignalR Inbound Event: MT5 Position Closed', position);
    });

    // Attempt start connection gracefully without console spam
    connection.start().then(() => {
      console.log('🟢 Connected to MT5 SignalR Bridge Hub successfully.');
      connection.invoke('SubscribeAllClientsOverview').catch(() => {});
    }).catch(() => {
      console.log(`ℹ️ MT5 SignalR Bridge standing by (Hub URL: ${env.MT5_BRIDGE_URL})`);
    });

    return connection;
  } catch (err) {
    console.log(`ℹ️ MT5 SignalR Bridge standing by (${err.message})`);
    return null;
  }
};
