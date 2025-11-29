import express from 'express';
import bodyParser from 'body-parser';
import neo4j from 'neo4j-driver';

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

const logger = new Logger('ai-graph-service');
const app = express();
const PORT = process.env.PORT || 6000;

app.use(bodyParser.json());

// --- Neo4j Client ---
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';
const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));

// --- Neo4j Logic ---
async function updateGraph(sender: string, receiver: string, amount: number, txnId: string) {
    const session = driver.session();
    try {
        await session.run(
            `
            MERGE (s:User {id: $sender})
            MERGE (r:User {id: $receiver})
            MERGE (s)-[t:TRANSFERRED {txnId: $txnId, amount: $amount, timestamp: datetime()}]->(r)
            `,
            { sender, receiver, amount, txnId }
        );
        logger.info('Graph Updated', { sender, receiver });
    } catch (e) {
        logger.error('Graph Update Failed', e);
    } finally {
        await session.close();
    }
}

async function getFraudScore(userId: string): Promise<number> {
    const session = driver.session();
    try {
        // Heuristic: High In-Degree (Fan-In) = Potential Mule
        const result = await session.run(
            `
            MATCH (u:User {id: $userId})<-[r:TRANSFERRED]-()
            RETURN count(r) as inDegree
            `,
            { userId }
        );

        if (result.records.length === 0) return 0;

        const inDegree = result.records[0].get('inDegree').toNumber();
        logger.info('Calculated In-Degree', { userId, inDegree });

        // Simple Sigmoid-like normalization
        // 10 incoming txns => ~0.8 score
        return Math.min(inDegree / 12, 1.0);
    } catch (e) {
        logger.error('Neo4j Query Failed', e);
        return 0;
    } finally {
        await session.close();
    }
}

// --- API: Predict Fraud Score (Mock AI Model) ---
app.post('/v1/ai/predict', async (req, res) => {
    const { userId } = req.body;
    const score = await getFraudScore(userId);
    logger.info('AI Prediction Served', { userId, score });
    res.json({ fraudScore: score });
});

// --- API: Update Graph (Called by Risk Engine or Worker) ---
app.post('/v1/graph/update', async (req, res) => {
    const { senderId, receiverId, amount, txnId } = req.body;
    await updateGraph(senderId, receiverId, amount, txnId);
    res.json({ status: 'Graph Updated' });
});

// --- Worker (Redis Listener) ---
import { createClient } from 'redis';
const redisSubscriber = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redisSubscriber.on('error', (err) => logger.error('Redis Subscriber Error', err));

async function startWorker() {
    await redisSubscriber.connect();
    logger.info('AI Graph Service Connected to Redis & Neo4j');

    await redisSubscriber.subscribe('transaction_events', async (message) => {
        try {
            const data = JSON.parse(message);
            if (data.eventType === 'TRANSACTION_COMPLETED' && data.action !== 'BLOCK') {
                const sender = data.userId;
                const receiver = data.receiverId;
                if (sender && receiver) {
                    await updateGraph(sender, receiver, data.amount, data.txnId);
                }
            }
        } catch (e) {
            logger.error('Error processing event', e);
        }
    });

    app.listen(PORT, () => {
        logger.info(`AI Graph Service running on port ${PORT}`);
    });
}

startWorker();
