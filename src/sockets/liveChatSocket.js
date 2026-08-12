/**
 * Socket.IO Handler for Real-Time Live Support Chat
 * Blueprint Section 2.2: User-to-Admin & User-to-Server Bidirectional Messaging
 */
export const attachLiveChatSocket = (io) => {
  const chatNamespace = io.of('/live-chat');

  chatNamespace.on('connection', (socket) => {
    console.log(`💬 LiveChat Socket Connected: ${socket.id}`);

    socket.on('join_chat_room', (data) => {
      const roomId = data.room_id || `room_${data.user_id}`;
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined LiveChat room: ${roomId}`);
    });

    socket.on('send_message', (data) => {
      const { room_id, sender_type, message, sender_name } = data;
      const messagePayload = {
        id: Date.now(),
        room_id,
        sender_type, // 'user' or 'agent'
        sender_name: sender_name || (sender_type === 'user' ? 'Trader' : 'Support Representative'),
        message,
        timestamp: new Date().toISOString()
      };

      // Broadcast to room
      chatNamespace.to(room_id).emit('receive_message', messagePayload);
    });

    socket.on('agent_typing', (data) => {
      socket.to(data.room_id).emit('agent_typing_status', { isTyping: data.isTyping });
    });

    socket.on('disconnect', () => {
      console.log(`💬 LiveChat Socket Disconnected: ${socket.id}`);
    });
  });
};
