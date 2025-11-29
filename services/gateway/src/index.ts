import bodyParser from 'body-parser';
import cors from 'cors';
import crypto from 'crypto';
import express from 'express';
import { createClient } from 'redis';

// Minimal structured logger to avoid external dependencies in Docker
class Logger {
    constructor(private readonly serviceName: string) {}

    info(message: string, meta: Record<string, unknown> = {}) {
        console.log(JSON.stringify(this.withBasePayload('INFO', message, meta)));
    }

    warn(message: string, meta: Record<string, unknown> = {}) {
        console.warn(JSON.stringify(this.withBasePayload('WARN', message, meta)));
    }

    error(message: string, error?: unknown) {
        const meta: Record<string, unknown> = { error };
        if (error instanceof Error) {
            meta.error = error.message;
            meta.stack = error.stack;
        }
        console.error(JSON.stringify(this.withBasePayload('ERROR', message, meta)));
    }

    private withBasePayload(severity: string, message: string, meta: Record<string, unknown>) {
        return {
            severity,
            service: this.serviceName,
            message,
            timestamp: new Date().toISOString(),
            ...meta
        };
    }
}

const logger = new Logger('gateway');
const PORT = Number(process.env.PORT || 3000);
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

const CLIENT_SECRETS: Record<string, string> = {
    [process.env.CLIENT_ID || 'mumbai-hacks-client-001']: process.env.HMAC_SECRET || 'hmac-secret-8f7d2b3c4d5e6f7a8b9c0d1e2f3a4b5c'
};

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/health', (_req, res) => res.status(200).json({ status: 'OK' }));

const validateHmacSignature: express.RequestHandler = (req, res, next) => {
    const clientId = (req.headers['x-client-id'] as string) || '';
    const timestamp = (req.headers['x-timestamp'] as string) || '';
    const signature = (req.headers['x-signature'] as string) || '';

    if (!clientId || !timestamp || !signature) {
        logger.warn('Missing Security Headers', { clientId: clientId || 'unknown' });
        return res.status(401).json({ error: 'Missing Security Headers (x-client-id, x-timestamp, x-signature)' });
    }

    const secret = CLIENT_SECRETS[clientId];
    if (!secret) {
        logger.warn('Invalid Client ID', { clientId });
        return res.status(401).json({ error: 'Invalid Client ID' });
    }

    const now = Date.now();
    const reqTime = Number(timestamp);
    if (!Number.isFinite(reqTime) || Math.abs(now - reqTime) > 5 * 60 * 1000) {
        logger.warn('Replay Attack Detected or Clock Skew', { clientId, timestamp });
        return res.status(401).json({ error: 'Request Expired (Check System Clock)' });
    }

    const bodyString = JSON.stringify(req.body || {});
    const stringToSign = `${timestamp}${req.method}${req.path}${bodyString}`;
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(stringToSign)
        .digest('hex');

    if (signature !== expectedSignature) {
        logger.warn('Invalid Signature', { clientId });
        return res.status(401).json({ error: 'Invalid HMAC Signature' });
    }

    logger.info('Authenticated Request', { clientId });
    return next();
};

app.use(validateHmacSignature);

const dlpMiddleware: express.RequestHandler = (_req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
        if (body && typeof body === 'object') {
            const strBody = JSON.stringify(body);
            const maskedBody = strBody.replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?(\d{4})\b/g, 'XXXX-XXXX-XXXX-$1');
            return originalJson(JSON.parse(maskedBody));
        }
        return originalJson(body);
    };
    next();
};

app.use(dlpMiddleware);

const redisPublisher = createClient({ url: REDIS_URL });
const redisSubscriber = createClient({ url: REDIS_URL });

redisPublisher.on('error', (err) => logger.error('Redis Publisher Error', err));
redisSubscriber.on('error', (err) => logger.error('Redis Subscriber Error', err));

async function startServer() {
    try {
        await Promise.all([redisPublisher.connect(), redisSubscriber.connect()]);
        logger.info('Connected to Redis', { url: REDIS_URL });
    } catch (error) {
        logger.error('Failed to connect to Redis', error);
        process.exit(1);
    }

    app.post('/v1/transaction/assess', async (req, res) => {
        const txnId = crypto.randomUUID();
        const transactionData = {
            txnId,
            ...req.body,
            timestamp: new Date().toISOString()
        };

        logger.info('Received Transaction', { txnId });

        await redisPublisher.lPush('transaction_queue', JSON.stringify(transactionData));

        logger.info('Async Request Accepted', { txnId });
        return res.status(202).json({
            txnId,
            status: 'PENDING',
            message: 'Transaction accepted for risk assessment. Result will be sent via webhook.'
        });
    });

    app.listen(PORT, () => {
        logger.info(`Gateway Service running on port ${PORT}`);
    });
}

startServer().catch((error) => {
    logger.error('Gateway failed to start', error);
    process.exit(1);
});
