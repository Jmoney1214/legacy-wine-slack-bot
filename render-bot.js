#!/usr/bin/env node
/**
 * 🦸‍♂️ MARKETING HERO BOT - RENDER DEPLOYMENT
 *
 * 24/7 Slack bot with DALL-E + Approval workflow
 * Checks Slack every 20 seconds for @mentions and reactions
 */

import { WebClient } from '@slack/web-api';
import OpenAI from 'openai';
import axios from 'axios';
import dotenv from 'dotenv';
import FormData from 'form-data';

dotenv.config();

// Initialize clients
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configuration
const CONFIG = {
  channelId: process.env.SLACK_CHANNEL || 'C09M2PHPRJ6',
  botUserId: process.env.SLACK_BOT_USER_ID || 'U09LZ8FUHNH',
  zapierWebhook: process.env.ZAPIER_INSTAGRAM_WEBHOOK,
  checkInterval: 20000, // 20 seconds
  port: process.env.PORT || 3000
};

class MarketingHeroBot {
  constructor() {
    this.processedMessages = new Set();
    this.processedReactions = new Set();
    this.postHistory = [];
    this.analytics = {
      postsGenerated: 0,
      postsApproved: 0,
      postsPosted: 0,
      errors: 0,
      startTime: new Date()
    };
  }

  async start() {
    console.log('\n' + '═'.repeat(80));
    console.log('🦸‍♂️ MARKETING HERO BOT - RENDER DEPLOYMENT');
    console.log('═'.repeat(80));
    console.log('\n📊 Configuration:');
    console.log('  Channel:', CONFIG.channelId);
    console.log('  Bot User:', CONFIG.botUserId);
    console.log('  Check Interval: Every 20 seconds');
    console.log('  Deployment: Render.com');
    console.log('\n👂 Starting monitoring loop...\n');

    // Health check endpoint for Render
    const express = (await import('express')).default;
    const app = express();

    app.get('/', (req, res) => {
      res.json({
        status: 'online',
        uptime: Math.floor(process.uptime()),
        analytics: this.analytics,
        lastCheck: new Date().toISOString()
      });
    });

    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    app.listen(CONFIG.port, () => {
      console.log(`✅ Health check server running on port ${CONFIG.port}`);
    });

    // Start monitoring loop
    this.monitorLoop();
  }

  async monitorLoop() {
    while (true) {
      try {
        await this.checkForMessages();
        await this.checkForReactions();
      } catch (error) {
        console.error('❌ Error:', error.message);
        this.analytics.errors++;
      }
      await this.sleep(CONFIG.checkInterval);
    }
  }

  async checkForMessages() {
    const result = await slack.conversations.history({
      channel: CONFIG.channelId,
      limit: 20
    });

    if (!result.messages) return;

    for (const message of result.messages.reverse()) {
      if (this.processedMessages.has(message.ts)) continue;
      if (message.bot_id || message.user === CONFIG.botUserId) continue;

      const text = message.text || '';
      if (!text.includes(`<@${CONFIG.botUserId}>`)) continue;

      this.processedMessages.add(message.ts);
      const cleanMessage = text.replace(/<@[A-Z0-9]+>/g, '').trim();

      console.log(`\n💬 New message: "${cleanMessage}"`);
      await this.handleMessage(message, cleanMessage);
    }
  }

  async handleMessage(message, userMessage) {
    const lower = userMessage.toLowerCase();

    // Handle stats
    if (lower.includes('stats')) {
      return await this.sendStats(message);
    }

    // Handle content generation
    if (lower.includes('generate') || lower.includes('create') || lower.includes('make') || lower.includes('post')) {
      return await this.generateWithDalle(message, userMessage);
    }

    // General conversation
    await this.sendReply(message, "Hey! I can generate posts for you.\n\nTry:\n• generate Halloween post\n• create wine post\n• make whiskey content\n• stats");
  }

  async generateWithDalle(message, userMessage) {
    console.log('🎨 Generating DALL-E post...');
    this.analytics.postsGenerated++;

    try {
      await slack.chat.postMessage({
        channel: CONFIG.channelId,
        text: '🎨 Creating custom DALL-E image and caption... one moment!',
        thread_ts: message.ts
      });

      // Step 1: Generate DALL-E image
      const imagePrompt = this.createImagePrompt(userMessage);
      const dalleResponse = await openai.images.generate({
        model: 'dall-e-3',
        prompt: imagePrompt,
        size: '1024x1024',
        quality: 'hd',
        style: 'vivid',
        n: 1,
      });

      const dalleUrl = dalleResponse.data[0].url;
      console.log('✅ DALL-E generated');

      // Step 2: Download image
      const imageData = await axios.get(dalleUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(imageData.data);

      // Step 3: Upload to Imgur
      const imgurUrl = await this.uploadToImgur(imageBuffer);
      console.log('✅ Uploaded to Imgur:', imgurUrl);

      // Step 4: Generate caption
      const caption = await this.generateCaption(userMessage);
      console.log('✅ Caption generated');

      // Step 5: Send to Slack for approval
      await slack.chat.postMessage({
        channel: CONFIG.channelId,
        text: `🦸‍♂️ **POST TO INSTAGRAM**

**CAPTION:**
${caption}

**IMAGE:**
${imgurUrl}

**HASHTAGS:**
#LegacyWine #SanfordFL #Halloween2025 #FreeCocktails #LocalEvents

---
✅ React with ✅ to post to Instagram!
💬 Reply to regenerate

🎨 Custom DALL-E 3 image • Permanent Imgur URL`,
        thread_ts: message.ts
      });

      console.log('✅ Sent to Slack for approval');

    } catch (error) {
      console.error('❌ Generation error:', error.message);
      await slack.chat.postMessage({
        channel: CONFIG.channelId,
        text: `❌ Error: ${error.message}`,
        thread_ts: message.ts
      });
    }
  }

  async uploadToImgur(imageBuffer) {
    const base64Image = imageBuffer.toString('base64');
    const response = await axios.post('https://api.imgur.com/3/image', {
      image: base64Image,
      type: 'base64'
    }, {
      headers: {
        'Authorization': 'Client-ID 546c25a59c58ad7',
        'Content-Type': 'application/json'
      }
    });
    return response.data.data.link;
  }

  createImagePrompt(userMessage) {
    const lower = userMessage.toLowerCase();

    if (lower.includes('halloween')) {
      return 'Epic Halloween party at upscale liquor store. Vibrant neon purple and orange lighting, glowing jack-o-lanterns, elegant cocktails with fog, premium spirits. High energy party atmosphere, professional photography.';
    }

    if (lower.includes('wine')) {
      return 'Elegant wine display at premium liquor store. Beautiful wine glasses, bottles, sophisticated lighting, upscale ambiance.';
    }

    if (lower.includes('whiskey')) {
      return 'Premium whiskey collection at upscale liquor store. Aged bottles, amber lighting, sophisticated aesthetic.';
    }

    return 'Exciting premium liquor store display with cocktails, bottles, and sophisticated atmosphere.';
  }

  async generateCaption(userMessage) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{
        role: 'system',
        content: 'You are a viral Instagram expert for Legacy Wine & Liquor in Sanford, FL.'
      }, {
        role: 'user',
        content: `Create Instagram caption for: ${userMessage}. Include emojis, store info (200 S French Ave, Sanford, FL, 407-915-7812), and "21+ Only | Drink Responsibly". Make it exciting!`
      }],
      temperature: 0.9,
      max_tokens: 300
    });

    return response.choices[0].message.content;
  }

  async checkForReactions() {
    const result = await slack.conversations.history({
      channel: CONFIG.channelId,
      limit: 10
    });

    if (!result.messages) return;

    for (const message of result.messages) {
      if (!message.text || !message.text.includes('POST TO INSTAGRAM')) continue;

      const reactionKey = `${message.ts}_approved`;
      if (this.processedReactions.has(reactionKey)) continue;

      if (message.reactions) {
        const hasApproval = message.reactions.some(r =>
          r.name === 'white_check_mark' || r.name === 'heavy_check_mark'
        );

        if (hasApproval) {
          this.processedReactions.add(reactionKey);
          await this.postToInstagram(message);
        }
      }
    }
  }

  async postToInstagram(message) {
    console.log('\n📸 Posting to Instagram...');
    this.analytics.postsApproved++;

    const text = message.text;
    const captionMatch = text.match(/CAPTION:\s*([\s\S]*?)(?=\*\*IMAGE:|\nIMAGE:|IMAGE:|$)/);
    const imageMatch = text.match(/IMAGE:\s*<?([^\s>]+)>?/);

    if (!captionMatch || !imageMatch) {
      console.error('❌ Could not extract content');
      return;
    }

    try {
      await axios.post(CONFIG.zapierWebhook, {
        action: 'post_to_instagram',
        caption: captionMatch[1].trim(),
        media: imageMatch[1].trim(),
        media_url: imageMatch[1].trim(),
        image_url: imageMatch[1].trim(),
        instagram_page_id: '17841463539272316',
        timestamp: new Date().toISOString(),
        post_id: `render_${Date.now()}`
      });

      this.analytics.postsPosted++;
      console.log('✅ Posted to Instagram!');

      await slack.chat.postMessage({
        channel: CONFIG.channelId,
        text: `✅ Posted to Instagram successfully! 🎉`,
        thread_ts: message.ts
      });

    } catch (error) {
      console.error('❌ Instagram post failed:', error.message);
      this.analytics.errors++;
    }
  }

  async sendStats(message) {
    const uptime = Math.floor((Date.now() - this.analytics.startTime) / 1000 / 60);
    const successRate = this.analytics.postsApproved > 0
      ? Math.round((this.analytics.postsPosted / this.analytics.postsApproved) * 100)
      : 100;

    await slack.chat.postMessage({
      channel: CONFIG.channelId,
      text: `📊 **MARKETING HERO STATS**

**Performance:**
• Posts Generated: ${this.analytics.postsGenerated}
• Posts Approved: ${this.analytics.postsApproved}
• Posts Posted: ${this.analytics.postsPosted}
• Success Rate: ${successRate}%
• Errors: ${this.analytics.errors}

**System:**
• Uptime: ${uptime} minutes
• Deployment: Render.com
• Status: 🟢 Online

🦸‍♂️ Marketing Hero Bot`,
      thread_ts: message.ts
    });
  }

  async sendReply(message, text) {
    await slack.chat.postMessage({
      channel: CONFIG.channelId,
      text: text,
      thread_ts: message.ts
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Start bot
const bot = new MarketingHeroBot();

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});

bot.start().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
