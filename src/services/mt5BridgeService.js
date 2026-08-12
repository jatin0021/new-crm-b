import * as signalR from '@microsoft/signalr';
import { env } from '../config/env.js';

export const connectMt5Bridge = async () => {
  try {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(env.MT5_BRIDGE_URL)
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
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

    // Attempt start connection gracefully without blocking server startup if MT5 server is offline
    connection.start().then(() => {
      console.log('🟢 Connected to MT5 SignalR Bridge Hub successfully.');
      connection.invoke('SubscribeAllClientsOverview').catch(() => {});
    }).catch(err => {
      console.warn(`⚠️ MT5 SignalR Bridge Hub connection offline (${err.message}). Bridge retry active.`);
    });

    return connection;
  } catch (err) {
    console.warn(`⚠️ MT5 SignalR Client Initialization warning: ${err.message}`);
    return null;
  }
};
