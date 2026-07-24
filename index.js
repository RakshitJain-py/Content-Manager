// index.js
// Entry point to run both the Express Web Dashboard and the Telegram Bot concurrently on the cloud.

console.log('🚀 Starting Content Manager Services...');

// 1. Start the Express server
require('./server.js');

// 2. Start the Telegram Bot listener
require('./bot.js');
