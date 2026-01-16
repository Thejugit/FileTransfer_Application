const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});

const wss = new WebSocket.Server({ server });

// Store active rooms with their connections
const rooms = new Map();

// Generate random 4-digit code
function generateCode() {
  let code;
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
  } while (rooms.has(code));
  return code;
}

// Clean up expired rooms (older than 30 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.created > 30 * 60 * 1000) {
      room.connections.forEach(conn => {
        if (conn.readyState === WebSocket.OPEN) {
          conn.close();
        }
      });
      rooms.delete(code);
      console.log(`Cleaned up expired room: ${code}`);
    }
  }
}, 60000);

wss.on('connection', (ws) => {
  console.log('New client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'create-room':
          const code = generateCode();
          rooms.set(code, {
            connections: [ws],
            created: Date.now()
          });
          ws.roomCode = code;
          ws.send(JSON.stringify({ type: 'room-created', code }));
          console.log(`Room created: ${code}`);
          break;
          
        case 'join-room':
          const room = rooms.get(data.code);
          if (!room) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid code' }));
            return;
          }
          
          if (room.connections.length >= 2) {
            ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
            return;
          }
          
          room.connections.push(ws);
          ws.roomCode = data.code;
          
          // Notify both peers that connection is ready
          room.connections.forEach(conn => {
            if (conn.readyState === WebSocket.OPEN) {
              conn.send(JSON.stringify({ type: 'peer-joined' }));
            }
          });
          console.log(`Client joined room: ${data.code}`);
          break;
          
        case 'offer':
        case 'answer':
        case 'ice-candidate':
          // Forward WebRTC signaling messages to the other peer
          const currentRoom = rooms.get(ws.roomCode);
          if (currentRoom) {
            currentRoom.connections.forEach(conn => {
              if (conn !== ws && conn.readyState === WebSocket.OPEN) {
                conn.send(JSON.stringify(data));
              }
            });
          }
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
    if (ws.roomCode) {
      const room = rooms.get(ws.roomCode);
      if (room) {
        room.connections = room.connections.filter(conn => conn !== ws);
        
        // Notify other peer about disconnection
        room.connections.forEach(conn => {
          if (conn.readyState === WebSocket.OPEN) {
            conn.send(JSON.stringify({ type: 'peer-disconnected' }));
          }
        });
        
        // Clean up empty rooms
        if (room.connections.length === 0) {
          rooms.delete(ws.roomCode);
          console.log(`Room deleted: ${ws.roomCode}`);
        }
      }
    }
  });
});
