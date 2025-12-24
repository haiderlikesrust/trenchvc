# Deployment Guide - What Goes Where

## Overview

Your Trench VC app has **2 parts** that need to be deployed separately:

1. **Frontend (Static Files)** → Vercel ✅
2. **WebSocket Server** → Railway/Render (separate deployment) ⚠️

---

## Part 1: Frontend (Vercel) ✅

### Files to Deploy to Vercel:
- `index.html` (root)
- `client.js` (root)
- `style.css` (root)
- `vercel.json`
- `package.json` (for dependencies, though not needed for static files)

### What This Does:
- Serves the UI/website
- Users can see and interact with the interface
- **BUT:** Voice chat won't work without the WebSocket server

### Current Status:
✅ Already deployed to Vercel (trenchvc.vercel.app)

---

## Part 2: WebSocket Server (Railway/Render) ⚠️

### Files Needed for WebSocket Server:

**Required Files:**
- `server.js` - The WebSocket signaling server
- `package.json` - Dependencies (express, ws, uuid)

**Optional but Recommended:**
- `.gitignore` - To exclude node_modules
- `README.md` - Documentation

### What This Does:
- Handles WebSocket connections for WebRTC signaling
- Connects users together for voice chat
- **Critical:** Without this, voice chat won't work

### Files NOT Needed:
- `index.html` ❌
- `client.js` ❌ (this runs in browser)
- `style.css` ❌
- `vercel.json` ❌

---

## Step-by-Step: Deploy WebSocket Server

### Option 1: Railway (Recommended - Free Tier Available)

1. **Go to [railway.app](https://railway.app)** and sign up

2. **Create New Project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your repository

3. **Configure Deployment:**
   - Railway auto-detects Node.js
   - **Build Command:** (leave empty or `npm install`)
   - **Start Command:** `node server.js`
   - **Root Directory:** (leave as root)

4. **Environment Variables (if needed):**
   - `PORT` - Railway sets this automatically
   - No other vars needed for basic setup

5. **Get Your URL:**
   - Railway gives you a URL like: `trenchvc-production.up.railway.app`
   - Copy this URL (without `https://`)

6. **Update Frontend:**
   - Edit `client.js` (in your Vercel deployment)
   - Find `connectWebSocket()` function (around line 48)
   - Update:
   ```javascript
   connectWebSocket() {
       const wsServer = 'trenchvc-production.up.railway.app'; // Your Railway URL
       const protocol = 'wss:';
       const wsUrl = `${protocol}//${wsServer}`;
       this.ws = new WebSocket(wsUrl);
       // ... rest of code
   }
   ```

7. **Redeploy Vercel:**
   - Push the updated `client.js` to trigger Vercel redeploy
   - Or manually redeploy in Vercel dashboard

---

### Option 2: Render (Free Tier Available)

1. **Go to [render.com](https://render.com)** and sign up

2. **Create New Web Service:**
   - Click "New" → "Web Service"
   - Connect your GitHub repository

3. **Configure:**
   - **Name:** `trenchvc-websocket`
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free (or paid for WebSocket support)

4. **Get Your URL:**
   - Render gives you: `trenchvc-websocket.onrender.com`
   - Update `client.js` with this URL

5. **Note:** Render's free tier may have WebSocket limitations. Check their docs.

---

## File Structure Summary

```
trenchvc/
├── index.html          → Vercel ✅
├── client.js           → Vercel ✅
├── style.css           → Vercel ✅
├── vercel.json         → Vercel ✅
│
├── server.js           → Railway/Render ⚠️
├── package.json        → Railway/Render ⚠️
│
└── public/            → Ignore (old location)
```

---

## Quick Checklist

### Vercel Deployment:
- [x] Static files in root directory
- [x] vercel.json configured
- [x] Files deployed and accessible
- [ ] (Optional) Update client.js with WebSocket URL after server is deployed

### Railway/Render Deployment:
- [ ] Create account
- [ ] Connect GitHub repo
- [ ] Set start command: `node server.js`
- [ ] Deploy and get URL
- [ ] Update client.js with WebSocket server URL
- [ ] Test voice chat

---

## Testing

1. **Test Frontend (Vercel):**
   - Visit your Vercel URL
   - UI should load
   - Try clicking "Join Voice Channel"
   - Should see "Connecting..." error (expected - no WebSocket server)

2. **Test WebSocket Server (Railway):**
   - Check Railway logs for "Server running" message
   - Test WebSocket connection (use browser console or WebSocket test tool)

3. **Test Full App:**
   - After updating client.js with Railway URL
   - Redeploy Vercel
   - Open two browser windows
   - Both should connect and voice chat should work!

---

## Troubleshooting

**"Cannot connect to WebSocket":**
- Check Railway/Render URL is correct
- Ensure server is running (check logs)
- Verify protocol is `wss:` (secure) for HTTPS sites

**"403 errors on Vercel":**
- ✅ Already fixed - files are in root now

**"Voice chat not working":**
- WebSocket server must be deployed separately
- Check client.js has correct WebSocket URL
- Verify both deployments are live

---

## Cost

- **Vercel:** Free tier ✅
- **Railway:** Free tier available (500 hours/month) ✅
- **Render:** Free tier available (with limitations) ✅

Total: **$0/month** for basic usage!

