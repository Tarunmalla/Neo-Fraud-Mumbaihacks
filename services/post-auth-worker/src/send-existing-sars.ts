import axios from 'axios';
import fs from 'fs';
import path from 'path';

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1443623614195957762/gKUbDF0BPtGQ_6E_tCDSporXCdQHppUyk17y8mwZTPXmVhe0tBSBQx5znmgvM8ZiDdhn';
const WORKER_DIR = path.join(__dirname, '..');

async function sendDiscordAlert(filename: string, content: string) {
    try {
        console.log(`[Discord] Sending ${filename}...`);
        // Discord has a 2000 char limit, so we might need to truncate or send as file.
        // For now, we'll send a summary.

        await axios.post(DISCORD_WEBHOOK_URL, {
            content: `🚨 **HISTORICAL SAR REPORT: ${filename}**\n\n\`\`\`\n${content.substring(0, 1800)}\n\`\`\`\n*(Truncated if too long)*`
        });
        console.log(`[Discord] Sent ${filename}.`);
    } catch (e: any) {
        console.error(`[Discord] Failed to send ${filename}:`, e.message);
        if (e.response && e.response.status === 429) {
            console.log('Rate limited. Waiting 5 seconds...');
            await new Promise(r => setTimeout(r, 5000));
            await sendDiscordAlert(filename, content); // Retry
        }
    }
}

async function processExistingSARs() {
    console.log(`Scanning ${WORKER_DIR} for SAR files...`);
    const files = fs.readdirSync(WORKER_DIR).filter(f => f.startsWith('SAR-') && f.endsWith('.txt'));

    if (files.length === 0) {
        console.log('No SAR files found.');
        return;
    }

    console.log(`Found ${files.length} SAR files.`);

    for (const file of files) {
        const content = fs.readFileSync(path.join(WORKER_DIR, file), 'utf-8');
        await sendDiscordAlert(file, content);
        // Add a small delay to avoid hitting Discord rate limits too hard
        await new Promise(r => setTimeout(r, 1000));
    }

    console.log('--- All existing SARs processed ---');
}

processExistingSARs();
