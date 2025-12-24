# What Files Go Where? 📦

## Quick Answer

**Deploy to Vercel (Frontend):**
- ✅ `index.html`
- ✅ `client.js`
- ✅ `style.css`
- ✅ `vercel.json`

**Deploy to Railway/Render (WebSocket Server):**
- ⚠️ `server.js`
- ⚠️ `package.json`

---

## Detailed Breakdown

### 🟢 Vercel Deployment (Already Done)

These files are **already on Vercel** and working:

```
✅ index.html     → The main HTML page
✅ client.js      → Frontend JavaScript (runs in browser)
✅ style.css      → Styling
✅ vercel.json    → Vercel configuration
```

**What it does:** Serves your website UI. Users can see and click buttons, but voice chat won't work yet.

---

### 🔴 Railway/Render Deployment (NOT Done Yet)

You need to deploy these files separately:

```
⚠️ server.js      → WebSocket signaling server (REQUIRED)
⚠️ package.json   → Dependencies list (REQUIRED)
```

**What it does:** Handles WebSocket connections so users can actually voice chat.

**Files you DON'T need:**
- ❌ `index.html` (already on Vercel)
- ❌ `client.js` (runs in browser, already on Vercel)
- ❌ `style.css` (already on Vercel)
- ❌ `vercel.json` (only for Vercel)

---

## Minimum Files for Railway/Render

Create a new folder or just deploy these 2 files:

```
websocket-server/
├── server.js      ← Copy this file
└── package.json   ← Copy this file
```

That's it! Railway/Render will install dependencies automatically.

---

## After Deploying WebSocket Server

1. Get your Railway/Render URL (e.g., `trenchvc.railway.app`)
2. Update `client.js` line ~50:
   ```javascript
   const wsServer = 'trenchvc.railway.app'; // Your Railway URL
   ```
3. Push to GitHub (triggers Vercel redeploy)
4. Voice chat will work! 🎉

---

## Summary Table

| File | Vercel | Railway/Render | Purpose |
|------|--------|----------------|---------|
| `index.html` | ✅ Yes | ❌ No | Main page |
| `client.js` | ✅ Yes | ❌ No | Frontend JS |
| `style.css` | ✅ Yes | ❌ No | Styling |
| `server.js` | ❌ No | ⚠️ **YES** | WebSocket server |
| `package.json` | ✅ Yes | ⚠️ **YES** | Dependencies |
| `vercel.json` | ✅ Yes | ❌ No | Vercel config |

---

**TL;DR:** Only `server.js` and `package.json` need to be deployed separately to Railway/Render. Everything else is already on Vercel.

