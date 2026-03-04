import cron from 'node-cron';
import fetch from 'node-fetch';

// Keep-alive ping every 10 minutes
cron.schedule('*/10 * * * *', async () => {
    try {
        await fetch(`https://gis-webview.onrender.com/health`);
        console.log('Keep-alive ping sent');
    } catch (err) {
        console.error('Keep-alive ping failed:', err.message);
    }
});