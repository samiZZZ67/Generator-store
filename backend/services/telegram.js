'use strict';

const https = require('https');

/**
 * Broadcasts order notification to all configured Telegram chat IDs (supports 5+ IDs).
 * Reads:
 * - TELEGRAM_BOT_TOKEN
 * - TELEGRAM_CHAT_IDS (comma-separated list, e.g. "12345678,98765432")
 */
async function sendTelegramNotification(order, items) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIdsStr = process.env.TELEGRAM_CHAT_IDS;
  
  if (!token || !chatIdsStr) {
    console.log("Telegram notifications skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_IDS not configured.");
    return;
  }

  // Parse up to 5+ chat IDs from comma-separated string
  const chatIds = chatIdsStr.split(',').map(id => id.trim()).filter(id => id.length > 0);
  if (chatIds.length === 0) {
    console.log("Telegram notifications skipped: No valid chat IDs found in TELEGRAM_CHAT_IDS.");
    return;
  }

  // Format notification message
  let itemDetails = '';
  for (const item of items) {
    const originalPriceText = item.original_price 
      ? ` (Was: Br ${item.original_price.toLocaleString()})`
      : '';
    itemDetails += `• ${item.name_en} (${item.name_am})\n  Qty: ${item.qty} x Br ${item.unit_price.toLocaleString()}${originalPriceText}\n`;
    if (item.marketing_desc_en) {
      itemDetails += `  Promo: "${item.marketing_desc_en}"\n`;
    }
  }

  const message = `⚡ NEW ORDER RECEIVED! ⚡
────────────────────
📝 Order ID: ${order.id}
📞 Channel: ${order.channel.toUpperCase()}
🌍 Language: ${order.lang.toUpperCase()}
📱 Customer WhatsApp: ${order.customer_wa || 'Not provided'}
💬 Customer Note: ${order.note || 'None'}

📦 Items Ordered:
${itemDetails}
────────────────────
💰 Total Price: Br ${order.total_etb.toLocaleString()} ETB
📅 Date: ${new Date().toLocaleString()}
`;

  // Send request to all chat IDs in parallel
  const sendPromises = chatIds.map(chatId => {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        chat_id: chatId,
        text: message
      });

      const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ chatId, success: true });
          } else {
            resolve({ chatId, success: false, error: body });
          }
        });
      });

      req.on('error', (e) => {
        resolve({ chatId, success: false, error: e.message });
      });

      req.write(postData);
      req.end();
    });
  });

  const results = await Promise.all(sendPromises);
  console.log("Telegram notification broadcast results:", results);
}

module.exports = {
  sendTelegramNotification
};
