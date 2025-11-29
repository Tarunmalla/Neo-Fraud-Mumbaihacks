import { createClient } from 'redis';
import { PubSub } from '@google-cloud/pubsub';

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

const logger = new Logger('risk-engine');

// --- Configuration ---
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PROJECT_ID = 'mumbaihacks-1';
const TOPIC_NAME = 'transaction-events';

// --- Clients ---
const redisClient = createClient({ url: REDIS_URL });
const redisPublisher = createClient({ url: REDIS_URL });
const pubsub = new PubSub({ projectId: PROJECT_ID });

redisClient.on('error', (err) => logger.error('Redis Client Error', err));
redisPublisher.on('error', (err) => logger.error('Redis Publisher Error', err));

// --- Risk Rules ---
function evaluateRisk(txn: any): { score: number; flags: string[] } {
    let score = 0;
    const flags: string[] = [];

    // Rule 1: High Amount
    if (txn.amount > 10000) {
        score += 40;
        flags.push('HIGH_AMOUNT');
    }

    // Rule 2: Cross-Border (Currency Check)
    if (txn.currency !== 'INR') {
        score += 20;
        flags.push('FOREIGN_CURRENCY');
    }

    // Rule 3: Rapid Velocity (Mock)
    if (Math.random() > 0.9) {
        score += 30;
        flags.push('VELOCITY_SPIKE');
    }

    return { score, flags };
}

async function startEngine() {
    await redisClient.connect();
    await redisPublisher.connect();
    logger.info('Risk Engine Started. Listening on transaction_queue...');

    while (true) {
        try {
            // Blocking Pop from Queue
            const result = await redisClient.brPop('transaction_queue', 0);
            if (!result) continue;

            const txnData = JSON.parse(result.element.toString());
            logger.info('Processing Transaction', { txnId: txnData.txnId });

            // 1. Evaluate Risk
            const { score, flags } = evaluateRisk(txnData);
            const action = score > 80 ? 'BLOCK' : (score > 50 ? 'REVIEW' : 'ALLOW');

            logger.info('Risk Assessment Complete', { txnId: txnData.txnId, score, action, flags });

            // 2. Publish Result (Internal Event)
            const resultPayload = {
                ...txnData,
                riskScore: score,
                riskFlags: flags,
                action: action,
                timestamp: new Date().toISOString()
            };

            // 3. Publish to Pub/Sub (For Post-Auth Worker)
            const dataBuffer = Buffer.from(JSON.stringify(resultPayload));
            try {
                const messageId = await pubsub.topic(TOPIC_NAME).publishMessage({ data: dataBuffer });
                logger.info('Published to Pub/Sub', { txnId: txnData.txnId, messageId });
            } catch (error) {
                logger.error('Pub/Sub Publish Failed', error);
            }

            // 4. Publish to Redis (For Webhook Service)
            await redisPublisher.publish(`transaction_result:${txnData.txnId}`, JSON.stringify(resultPayload));

        } catch (error) {
            logger.error('Engine Error', error);
            await new Promise(r => setTimeout(r, 1000)); // Backoff
        }
    }
}

startEngine();
