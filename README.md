# 🎤 TRENCH VC 🎤

A memey voice chat website where everyone joins one big chaotic VC call!

## Features

- 🎤 One single voice chat room for everyone
- 🔥 Real-time WebRTC audio communication
- 💜 Dark, gritty "Trench" aesthetic with neon accents
- 👥 See who's in the call with voice-reactive visualizations
- 🔇 Mute/unmute controls with live mic meter
- 🚪 Leave button with confirmation delay
- 📊 Connection quality indicators
- ⏱️ Room timer and invite link sharing

## Local Setup

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

## Deployment

### ⚠️ Important: WebSocket Limitation

**Vercel's free tier does NOT support WebSockets.** The current setup will serve the static files, but WebRTC signaling won't work.

### Option 1: Deploy WebSocket Server Separately (Recommended)

1. **Deploy static files to Vercel:**
   - The `vercel.json` is configured to serve static files
   - Deploy: `vercel --prod`

2. **Deploy WebSocket server to Railway/Render:**
   - Use the `server.js` file
   - Update the WebSocket URL in `public/client.js` to point to your Railway/Render server

### Option 2: Use Railway/Render for Full Stack

Deploy everything to Railway or Render (they support WebSockets):

1. **Railway:**
   ```bash
   railway init
   railway up
   ```

2. **Render:**
   - Connect your GitHub repo
   - Set build command: `npm install`
   - Set start command: `node server.js`

### Option 3: Use a WebSocket Service

Use services like:
- **Pusher** (free tier available)
- **Ably** (free tier available)
- **Socket.io with Redis** (on Railway/Render)

Then update the signaling logic in `client.js` to use their APIs.

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

Enjoy the chaos! 🎤🔥
