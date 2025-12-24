# 🎤 TRENCH VC 🎤

A memey voice chat website where everyone joins one big chaotic VC call!

## Features

- 🎤 One single voice chat room for everyone
- 🔥 Real-time WebRTC audio communication
- 💜 Memey design with Comic Sans and neon colors
- 👥 See who's in the call
- 🔇 Mute/unmute controls
- 🚪 Leave button

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser and go to:
```
http://localhost:3000
```

4. Allow microphone access when prompted

5. Start chatting! 🎉

## How It Works

- Uses WebRTC for peer-to-peer audio connections
- WebSocket server handles signaling between peers
- Each new user connects to all existing users
- All audio is transmitted in real-time

## Notes

- For best results, use HTTPS in production (WebRTC requires secure context)
- The current implementation uses a mesh topology (each peer connects to every other peer)
- For 100+ users, consider using a media server (SFU) like Janus, Kurento, or a service like Daily.co
- Make sure your firewall allows WebRTC traffic

## Deployment

For production deployment:
1. Use HTTPS (required for WebRTC)
2. Set up proper STUN/TURN servers for NAT traversal
3. Consider using a media server for better scalability

Enjoy the chaos! 🎤🔥

