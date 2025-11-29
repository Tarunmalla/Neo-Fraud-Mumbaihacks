import { createClient } from 'redis';

const client = createClient({ url: 'redis://localhost:6379' });

async function seed() {
    await client.connect();

    const badVPAs = ['fraudster@upi', 'hacker@icici', 'bot_net@okaxis'];

    await client.sAdd('vpa_blocklist', badVPAs);

    console.log('Seeded VPA Blocklist:', badVPAs);
    await client.disconnect();
}

seed();
