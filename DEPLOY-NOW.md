# 🚀 Deploy to Render RIGHT NOW (5 Minutes)

## Step 1: Create GitHub Repo (2 minutes)

1. Open this link in your browser: **https://github.com/new**

2. Fill in:
   - **Repository name:** `lightspeed-token-refresher`
   - **Description:** `24/7 Lightspeed token auto-refresher`
   - **Visibility:** ⚠️ **PRIVATE** (important - contains credentials)
   - ✅ Check "Add a README file"

3. Click **"Create repository"**

4. Copy the repo URL (looks like): `https://github.com/YOUR_USERNAME/lightspeed-token-refresher.git`

---

## Step 2: Push Code to GitHub (1 minute)

Run these commands in Terminal:

```bash
cd "/Users/justinetwaru/Desktop/lightspeed-token-refresher-deploy"

# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Token auto-refresher"

# Add your GitHub repo (REPLACE YOUR_USERNAME!)
git remote add origin https://github.com/YOUR_USERNAME/lightspeed-token-refresher.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## Step 3: Deploy on Render (2 minutes)

1. **Go to Render:** https://dashboard.render.com/

2. **Create New Service:**
   - Click **"New +"** button (top right)
   - Select **"Background Worker"**

3. **Connect GitHub:**
   - Click **"Connect GitHub"** (if not connected)
   - Find your repo: `lightspeed-token-refresher`
   - Click **"Connect"**

4. **Render Auto-Detects Configuration:**
   - Render reads `render.yaml` automatically
   - Name: `lightspeed-token-refresher` ✅
   - Runtime: Node ✅
   - Start Command: `node lightspeed-token-refresher-cloud.js` ✅

5. **Set Environment Variables:**

   Scroll down to **"Environment Variables"** section and add:

   | Key | Value |
   |-----|-------|
   | `LS_CLIENT_ID` | `0e7c182590b317952a3a0ca649697ed0064cfb4e91e413abf185c8db171dd9f1` |
   | `LS_CLIENT_SECRET` | `196e6fdfdf461acaa3b1cf7b7837e3978b99b276a03e1d109f0e6c295d143657` |
   | `LS_REFRESH_TOKEN` | **⚠️ GET NEW TOKEN FROM LIGHTSPEED** |
   | `SLACK_WEBHOOK_URL` | `https://hooks.zapier.com/hooks/catch/23493233/urrpmdj/` |
   | `SLACK_CHANNEL` | `#claude` |
   | `NODE_ENV` | `production` |

   **⚠️ IMPORTANT:** You need a fresh refresh token!
   - Go to: https://cloud.lightspeedapp.com/oauth/authorize.php
   - Copy the **refresh_token** value
   - Paste it in `LS_REFRESH_TOKEN`

6. **Deploy:**
   - Click **"Create Background Worker"**
   - Wait 1-2 minutes for deployment

---

## Step 4: Verify It's Running

1. **Check Render Logs:**
   - Click on your service in Render dashboard
   - Go to **"Logs"** tab
   - Should see: "Token refresher started!"

2. **Check Slack:**
   - Within a few minutes, you should see a token notification in #claude

3. **Success!** 🎉
   - Your token refresher is now running 24/7 in the cloud
   - Tokens will refresh automatically every 28 minutes
   - New tokens posted to Slack automatically

---

## 📝 Quick Copy-Paste Values

### Environment Variables (copy these):

```
LS_CLIENT_ID=0e7c182590b317952a3a0ca649697ed0064cfb4e91e413abf185c8db171dd9f1
LS_CLIENT_SECRET=196e6fdfdf461acaa3b1cf7b7837e3978b99b276a03e1d109f0e6c295d143657
LS_REFRESH_TOKEN=(GET FROM LIGHTSPEED)
SLACK_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/23493233/urrpmdj/
SLACK_CHANNEL=#claude
NODE_ENV=production
```

---

## ⏱️ Total Time: 5 Minutes

✅ Step 1: Create GitHub repo (2 min)
✅ Step 2: Push code (1 min)
✅ Step 3: Deploy on Render (2 min)
✅ Step 4: Verify (automatic)

**Done! Your tokens will never expire again!** 🚀
