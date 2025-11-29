import axios from 'axios';

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1443623614195957762/gKUbDF0BPtGQ_6E_tCDSporXCdQHppUyk17y8mwZTPXmVhe0tBSBQx5znmgvM8ZiDdhn';

async function sendTestAlert() {
    console.log('--- Sending Test Discord Alert ---');
    try {
        await axios.post(DISCORD_WEBHOOK_URL, {
            content: `🚨 **TEST ALERT**\n\nThis is a test message from the Fintech Platform.`
        });
        console.log('[Discord] Alert sent successfully.');
    } catch (e: any) {
        console.error('[Discord] Failed to send alert:', e.message);
        if (e.response) {
            console.error('Response:', e.response.data);
        }
    }
}

sendTestAlert();
