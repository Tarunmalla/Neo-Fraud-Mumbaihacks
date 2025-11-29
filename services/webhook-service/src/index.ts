import { createClient } from 'redis';
import axios from 'axios';
import crypto from 'crypto';

// Inline Logger to avoid Docker build context issues with relative imports
class Logger {
    private serviceName: string;

    constructor(serviceName: string) {
        this.serviceName = serviceName;
    }

    info(message: string, data?: any) {
        console.log(JSON.stringify({
            severity: 'INFO',
            service: this.serviceName,
            message,
            ...data,
            timestamp: new Date().toISOString()
        }));
    }

    error(message: string, error?: any) {
        console.error(JSON.stringify({
            severity: 'ERROR',
            service: this.serviceName,
            message,
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString()
        }));
    }

    warn(message: string, data?: any) {
        console.warn(JSON.stringify({
            severity: 'WARNING',
            service: this.serviceName,
            message,
            ...data,
            timestamp: new Date().toISOString()
        }));
    }
}

const logger = new Logger('webhook-service');
const redisSubscriber = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });

// Using the same secret for simplicity in this demo. 
const WEBHOOK_SECRET = 'hmac-secret-8f7d2b3c4d5e6f7a8b9c0d1e2f3a4b5c';
// In a real app, this URL would be fetched from a database based on the merchant ID
const MERCHANT_WEBHOOK_URL = 'http://localhost:4000/webhook-receiver';

redisSubscriber.on('error', (err) => logger.error('Redis Subscriber Error', err));

async function startService() {
    await redisSubscriber.connect();
    logger.info('Webhook Service Started. Listening for transaction results...');

    // Subscribe to all transaction results
    await redisSubscriber.pSubscribe('transaction_result:*', async (message, channel) => {
        try {
            const result = JSON.parse(message);
            logger.info('Processing Webhook', { txnId: result.txnId });

            await sendWebhook(result);

        } catch (error) {
            logger.error('Error processing message', error);
        }
    });
}

async function sendWebhook(payload: any) {
    const signature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');

    try {
        logger.info('Sending Webhook', { url: MERCHANT_WEBHOOK_URL });
        // Note: We are mocking the merchant server here. 
        // In a real scenario, we would retry on failure.
        await axios.post(MERCHANT_WEBHOOK_URL, payload, {
            headers: {
                'X-Webhook-Signature': signature,
                'Content-Type': 'application/json'
            }
        });
        logger.info('Webhook Sent Successfully');
    } catch (error: any) {
        logger.error('Failed to send Webhook', error);
    }
}

startService();
