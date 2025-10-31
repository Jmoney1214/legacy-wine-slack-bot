#!/usr/bin/env node

/**
 * Lightspeed Token Auto-Refresher (Cloud Version for Render)
 *
 * This service runs 24/7 on Render and automatically refreshes your Lightspeed
 * access token before it expires. It posts the new token to Slack so your local
 * system can pick it up.
 *
 * SETUP ON RENDER:
 * 1. Push this to GitHub
 * 2. Create a new Background Worker on Render
 * 3. Set environment variables:
 *    - LS_CLIENT_ID
 *    - LS_CLIENT_SECRET
 *    - LS_REFRESH_TOKEN
 *    - SLACK_WEBHOOK_URL (for posting token updates)
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════

const CONFIG = {
  // Lightspeed OAuth credentials (from environment)
  clientId: process.env.LS_CLIENT_ID || '0e7c182590b317952a3a0ca649697ed0064cfb4e91e413abf185c8db171dd9f1',
  clientSecret: process.env.LS_CLIENT_SECRET || '196e6fdfdf461acaa3b1cf7b7837e3978b99b276a03e1d109f0e6c295d143657',
  refreshToken: process.env.LS_REFRESH_TOKEN || 'd9cceea3fc47d840c45670d5a5d075aab4b7ca7b',

  // Slack webhook for token notifications
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || null,
  slackChannel: process.env.SLACK_CHANNEL || '#claude',

  // API endpoints
  tokenUrl: process.env.LS_TOKEN_URL || 'https://cloud.lightspeedapp.com/oauth/access_token.php',
  testApiUrl: 'https://api.lightspeedapp.com/API/V3/Account.json',

  // Local file paths (for local dev, ignored on Render)
  accessTokenFile: path.join(__dirname, 'config', 'lightspeed-token.txt'),
  tokensJsonFile: path.join(__dirname, 'lightspeed_tokens.json'),

  // Refresh timing
  checkIntervalSec: parseInt(process.env.LS_CHECK_INTERVAL_SEC || '300', 10),
  refreshMarginSec: parseInt(process.env.LS_REFRESH_MARGIN_SEC || '120', 10),

  // Runtime environment
  isCloud: process.env.NODE_ENV === 'production' || process.env.RENDER === 'true'
};

// In-memory token storage (for cloud)
let tokenState = {
  access_token: null,
  refresh_token: CONFIG.refreshToken,
  expires_at: null,
  obtained_at: null
};

// ═══════════════════════════════════════════════════════════
// TOKEN STORAGE
// ═══════════════════════════════════════════════════════════

/**
 * Load tokens from file (local) or memory (cloud)
 */
function loadTokens() {
  if (CONFIG.isCloud) {
    return tokenState.access_token ? tokenState : null;
  }

  if (!fs.existsSync(CONFIG.tokensJsonFile)) {
    return null;
  }

  try {
    const data = fs.readFileSync(CONFIG.tokensJsonFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('⚠️  Error loading tokens.json:', error.message);
    return null;
  }
}

/**
 * Save tokens to file (local) or memory (cloud)
 */
function saveTokens(tokenData) {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = tokenData.expires_in || 1800;

  const tokensJson = {
    token_type: tokenData.token_type || 'Bearer',
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_in: expiresIn,
    obtained_at: now,
    expires_at: now + expiresIn
  };

  if (CONFIG.isCloud) {
    // Store in memory
    tokenState = tokensJson;
    console.log(`✅ Tokens saved to memory (cloud mode)`);
  } else {
    // Store in file
    try {
      fs.writeFileSync(CONFIG.tokensJsonFile, JSON.stringify(tokensJson, null, 2), 'utf8');
      console.log(`✅ Tokens saved to: ${CONFIG.tokensJsonFile}`);
    } catch (error) {
      console.error('❌ Error saving tokens.json:', error.message);
      throw error;
    }
  }

  return tokensJson;
}

/**
 * Save access token to local file (local mode only)
 */
function saveAccessToken(accessToken) {
  if (CONFIG.isCloud) {
    return; // Skip in cloud mode
  }

  try {
    const configDir = path.dirname(CONFIG.accessTokenFile);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(CONFIG.accessTokenFile, accessToken, 'utf8');
    console.log(`✅ Access token saved to: ${CONFIG.accessTokenFile}`);
  } catch (error) {
    console.error('❌ Error saving access token:', error.message);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════
// SLACK NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

/**
 * Post token update to Slack
 */
async function notifySlack(accessToken, expiresAt) {
  if (!CONFIG.slackWebhookUrl) {
    console.log('ℹ️  No Slack webhook configured, skipping notification');
    return;
  }

  try {
    const expiresDate = new Date(expiresAt * 1000);
    const now = new Date();
    const minutesUntilExpiry = Math.floor((expiresDate - now) / 60000);

    const message = {
      channel: CONFIG.slackChannel,
      username: 'Lightspeed Token Bot',
      icon_emoji: ':key:',
      text: `🔑 Lightspeed Token Refreshed`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🔑 Lightspeed Token Auto-Refreshed',
            emoji: true
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*New Access Token:*\n\`${accessToken}\``
            },
            {
              type: 'mrkdwn',
              text: `*Expires In:*\n${minutesUntilExpiry} minutes`
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Expires at: <!date^${Math.floor(expiresDate.getTime() / 1000)}^{date_short_pretty} at {time}|${expiresDate.toLocaleString()}>`
            }
          ]
        },
        {
          type: 'divider'
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '🤖 Auto-refreshed by Render service • Next check in 5 minutes'
            }
          ]
        }
      ]
    };

    const response = await fetch(CONFIG.slackWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    if (response.ok) {
      console.log('✅ Token posted to Slack successfully');
    } else {
      console.error(`⚠️  Slack notification failed: HTTP ${response.status}`);
    }

  } catch (error) {
    console.error('⚠️  Error posting to Slack:', error.message);
  }
}

// ═══════════════════════════════════════════════════════════
// TOKEN REFRESH
// ═══════════════════════════════════════════════════════════

/**
 * Refresh the access token using refresh token
 */
async function refreshAccessToken(refreshToken) {
  console.log('🔄 Refreshing access token...');

  try {
    const formData = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CONFIG.clientId,
      client_secret: CONFIG.clientSecret
    });

    const response = await fetch(CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed (HTTP ${response.status}): ${errorText}`);
    }

    const data = await response.json();

    if (!data.access_token) {
      throw new Error('No access_token in response');
    }

    console.log('✅ Token refreshed successfully!');
    return data;

  } catch (error) {
    console.error('❌ Token refresh error:', error.message);
    throw error;
  }
}

/**
 * Test if the access token is valid
 */
async function testAccessToken(accessToken) {
  try {
    const response = await fetch(CONFIG.testApiUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// TOKEN LIFECYCLE MANAGEMENT
// ═══════════════════════════════════════════════════════════

/**
 * Check if token needs refresh
 */
function needsRefresh(tokens) {
  if (!tokens || !tokens.expires_at) {
    console.log('ℹ️  No valid token found, needs refresh');
    return true;
  }

  const now = Math.floor(Date.now() / 1000);
  const secondsUntilExpiry = tokens.expires_at - now;
  const minutesUntilExpiry = Math.floor(secondsUntilExpiry / 60);

  console.log(`ℹ️  Token expires in: ${minutesUntilExpiry} minutes (${secondsUntilExpiry} seconds)`);

  if (secondsUntilExpiry <= CONFIG.refreshMarginSec) {
    console.log(`⚠️  Token expires in ${minutesUntilExpiry} minutes, refreshing now...`);
    return true;
  }

  console.log('✅ Token is still valid');
  return false;
}

/**
 * Perform token refresh cycle
 */
async function performRefreshCycle() {
  try {
    let tokens = loadTokens();

    if (!needsRefresh(tokens)) {
      return;
    }

    const refreshToken = tokens?.refresh_token || CONFIG.refreshToken;

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const newTokenData = await refreshAccessToken(refreshToken);

    const isValid = await testAccessToken(newTokenData.access_token);
    if (!isValid) {
      console.error('⚠️  Warning: New token failed validation test');
    } else {
      console.log('✅ New token validated successfully');
    }

    tokens = saveTokens(newTokenData);
    saveAccessToken(newTokenData.access_token);

    // Update refresh token for next cycle
    if (newTokenData.refresh_token) {
      CONFIG.refreshToken = newTokenData.refresh_token;
      tokenState.refresh_token = newTokenData.refresh_token;
    }

    // Post to Slack (for cloud deployments)
    if (CONFIG.isCloud) {
      await notifySlack(newTokenData.access_token, tokens.expires_at);
    }

    console.log('✅ Refresh cycle complete!\n');

  } catch (error) {
    console.error('❌ Refresh cycle failed:', error.message);
    console.error('   Will retry on next cycle\n');
  }
}

/**
 * Initialize service
 */
async function initialize() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Lightspeed Token Auto-Refresher');
  if (CONFIG.isCloud) {
    console.log('  🌐 CLOUD MODE (Render)');
  } else {
    console.log('  💻 LOCAL MODE');
  }
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Check Interval: ${CONFIG.checkIntervalSec} seconds`);
  console.log(`  Refresh Margin: ${CONFIG.refreshMarginSec} seconds`);
  if (CONFIG.slackWebhookUrl) {
    console.log(`  Slack Notifications: ✅ Enabled`);
  } else {
    console.log(`  Slack Notifications: ⚠️  Disabled (no webhook)`);
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  // Try to load existing tokens
  if (!CONFIG.isCloud) {
    let currentAccessToken = null;
    try {
      if (fs.existsSync(CONFIG.accessTokenFile)) {
        currentAccessToken = fs.readFileSync(CONFIG.accessTokenFile, 'utf8').trim();
        console.log('ℹ️  Found existing access token in config');
      }
    } catch (error) {
      // Ignore
    }

    if (currentAccessToken && !fs.existsSync(CONFIG.tokensJsonFile)) {
      console.log('ℹ️  Creating initial tokens.json from current access token...');

      const isValid = await testAccessToken(currentAccessToken);

      if (isValid) {
        const now = Math.floor(Date.now() / 1000);
        const initialTokens = {
          token_type: 'Bearer',
          access_token: currentAccessToken,
          refresh_token: CONFIG.refreshToken,
          expires_in: 1800,
          obtained_at: now,
          expires_at: now + 1800
        };

        fs.writeFileSync(CONFIG.tokensJsonFile, JSON.stringify(initialTokens, null, 2), 'utf8');
        console.log('✅ Initial tokens.json created\n');
      } else {
        console.log('⚠️  Current access token is invalid, will refresh immediately\n');
      }
    }
  }

  console.log('🚀 Token refresher started! Running continuous monitoring...\n');
}

// ═══════════════════════════════════════════════════════════
// MAIN SERVICE LOOP
// ═══════════════════════════════════════════════════════════

/**
 * Main service loop
 */
async function runService() {
  await initialize();

  // Run immediate check
  await performRefreshCycle();

  // Set up periodic checks
  setInterval(async () => {
    const now = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    console.log(`⏰ [${now}] Running token check...`);
    await performRefreshCycle();
  }, CONFIG.checkIntervalSec * 1000);

  console.log(`✅ Service is running. Token will be checked every ${CONFIG.checkIntervalSec} seconds.`);
  if (CONFIG.isCloud) {
    console.log('   Running on Render - logs will appear in dashboard.');
  } else {
    console.log('   Press Ctrl+C to stop.');
  }
  console.log('\n');
}

// ═══════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════

process.on('SIGINT', () => {
  console.log('\n\n⏹️  Stopping token refresher service...');
  console.log('✅ Service stopped.\n');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⏹️  Stopping token refresher service...');
  console.log('✅ Service stopped.\n');
  process.exit(0);
});

if (require.main === module) {
  runService().catch(error => {
    console.error('\n❌ Fatal error:', error.message, '\n');
    process.exit(1);
  });
}

module.exports = { refreshAccessToken, testAccessToken, saveTokens };
