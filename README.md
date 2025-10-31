# 🔑 Lightspeed Token Auto-Refresher

24/7 automatic token refresher for Lightspeed Retail API.

## Features

- 🔄 Auto-refreshes tokens every 28 minutes
- 📢 Posts new tokens to Slack via Zapier webhook
- 🌐 Runs 24/7 on Render
- 🛡️ Proactive refresh (2 minutes before expiry)

## Environment Variables Required

- `LS_CLIENT_ID` - Lightspeed OAuth client ID
- `LS_CLIENT_SECRET` - Lightspeed OAuth client secret
- `LS_REFRESH_TOKEN` - Lightspeed refresh token (get from dashboard)
- `SLACK_WEBHOOK_URL` - Zapier webhook URL for Slack notifications
- `NODE_ENV=production` - Enables cloud mode

## Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

1. Click the deploy button above
2. Set environment variables in Render dashboard
3. Service will auto-start and refresh tokens every 28 minutes

Made for Shop 6 🏪
