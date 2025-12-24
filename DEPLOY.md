# Deployment Guide for Trench VC

## The Problem

Vercel's free tier **does not support WebSockets**, which are required for WebRTC signaling. The static files will deploy, but the voice chat won't work.

## Solution: Deploy WebSocket Server Separately

### Step 1: Deploy Static Files to Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel --prod
```

This will serve your static files (HTML, CSS, JS).

### Step 2: Deploy WebSocket Server to Railway (Free)

1. Go to [railway.app](https://railway.app) and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway will auto-detect Node.js
5. Set these in Railway dashboard:
   - **Build Command:** (leave empty, Railway auto-detects)
   - **Start Command:** `node server.js`
6. Railway will give you a URL like: `https://your-app.railway.app`
7. Copy the URL (without https://)

### Step 3: Update WebSocket URL

In `public/client.js`, update line ~51:

```javascript
connectWebSocket() {
    // Replace 'your-app.railway.app' with your Railway URL
    const wsServer = 'your-app.railway.app';
    const protocol = 'wss:'; // Always use secure for production
    const wsUrl = `${protocol}//${wsServer}`;
    
    this.ws = new WebSocket(wsUrl);
    // ... rest of code
}
```

Or use environment variable:
```javascript
const wsServer = process.env.WS_SERVER || 'your-app.railway.app';
```

### Step 4: Update Vercel Environment Variables (Optional)

If you want to use env vars:

1. In Vercel dashboard → Your Project → Settings → Environment Variables
2. Add: `NEXT_PUBLIC_WS_SERVER` = `your-app.railway.app`
3. Update client.js:
```javascript
const wsServer = process.env.NEXT_PUBLIC_WS_SERVER || window.location.host;
```

## Alternative: Deploy Everything to Railway

If you want everything in one place:

1. Deploy to Railway (same steps as above)
2. Railway will give you one URL for everything
3. No need to update WebSocket URLs
4. Update your domain to point to Railway

## Alternative: Use Render

1. Go to [render.com](https://render.com)
2. New → Web Service
3. Connect GitHub repo
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
5. Render supports WebSockets on paid plans

## Quick Fix for Testing

For now, to get Vercel working with static files:

1. Deploy to Vercel (static files will work)
2. Run `node server.js` locally
3. Update client.js temporarily to use your local IP:
```javascript
const wsUrl = 'ws://your-local-ip:3000';
```

This lets you test the UI on Vercel while using local WebSocket server.

