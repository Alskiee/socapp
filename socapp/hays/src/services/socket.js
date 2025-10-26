// Socket.IO client setup
// Requires: npm install socket.io-client
import { io } from 'socket.io-client';

let socket;

export function getSocket() {
  if (!socket) {
    // Connect to same host by default; customize via VITE_SOCKET_URL
    let url = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    // Socket.IO prefers http/https; normalize ws/wss
    if (url.startsWith('ws://')) url = 'http://' + url.slice(5);
    if (url.startsWith('wss://')) url = 'https://' + url.slice(6);
    socket = io(url, {
      withCredentials: true,
      transports: ['websocket'],
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = undefined;
  }
}
