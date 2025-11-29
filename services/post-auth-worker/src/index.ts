import { bigquery, pubsub, vertexAI, SUBSCRIPTION_NAME, DATASET_ID, TABLE_ID } from './gcp-client';
import fs from 'fs';
import path from 'path';
import neo4j from 'neo4j-driver';
import axios from 'axios';

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

const logger = new Logger('post-auth-worker');

// --- Discord Configuration ---
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || 'https://discord.com/api/webhooks/1443623614195957762/gKUbDF0BPtGQ_6E_tCDSporXCdQHppUyk17y8mwZTPXmVhe0tBSBQx5znmgvM8ZiDdhn';

async function sendDiscordAlert(subject: string, text: string) {
    try {
        await axios.post(DISCORD_WEBHOOK_URL, {
            content: `🚨 **${subject}**\n\n${text}`
        });
        logger.info('Discord Alert Sent', { subject });
    } catch (e: any) {
        logger.error('Failed to send Discord alert', e);
    }
}

// --- Neo4j Client ---
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';
const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));

// --- GenAI SAR Generator (Vertex AI) ---
async function generateSARReport(txnData: any, cycle: string[]) {
    logger.info('Generating SAR Report', { cycle });

    try {
        const model = vertexAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const prompt = `
        You are a Financial Crime Compliance Officer. Write a Suspicious Activity Report (SAR) for the following Money Laundering Ring:
        
        Cycle Detected: ${cycle.join(' -> ')}
        Transaction Details: ${JSON.stringify(txnData)}
        
        Format:
        1. Executive Summary
        2. Subject Details
        3. Suspicious Activity Description
        4. Conclusion
        `;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.candidates[0].content.parts[0].text;

        const filename = `SAR-${txnData.txnId}.txt`;
        const filePath = path.join(__dirname, '..', filename);
        fs.writeFileSync(filePath, text || 'No content generated');
        logger.info('SAR Report Saved', { filename });

        // Send Discord Alert
        await sendDiscordAlert(
            `SAR Generated: ${txnData.txnId}`,
            `A Suspicious Activity Report (SAR) has been generated for a detected Money Laundering Ring.\n\nCycle: ${cycle.join(' -> ')}\n\n**Report Content:**\n\`\`\`\n${text?.substring(0, 1000)}...\n\`\`\``
        );

        return text;
    } catch (e) {
        logger.error('Failed to generate SAR', e);
        return "Generation Failed";
    }
}

// --- BigQuery Audit Logging ---
async function logToBigQuery(data: any) {
    try {
        await bigquery.dataset(DATASET_ID).table(TABLE_ID).insert([data]);
        logger.info('Logged to BigQuery', { txnId: data.txnId });
    } catch (e) {
        logger.error('BigQuery Insert Failed', e);
    }
}

// --- Neo4j Cycle Detection ---
async function detectCycle(userId: string): Promise<string[] | null> {
    const session = driver.session();
    try {
        // Find a cycle of length 2 to 5 involving this user
        const result = await session.run(
            `
            MATCH path=(n:User {id: $userId})-[*2..5]->(n)
            RETURN [node in nodes(path) | node.id] as cycle
            LIMIT 1
            `,
            { userId }
        );

        if (result.records.length > 0) {
            return result.records[0].get('cycle');
        }
        return null;
    } catch (e) {
        logger.error('Neo4j Cycle Check Failed', e);
        return null;
    } finally {
        await session.close();
    }
}

// --- Main Worker ---
async function startWorker() {
    logger.info('Post-Auth Worker Started (GCP + Neo4j Mode)');

    const subscription = pubsub.subscription(SUBSCRIPTION_NAME);

    subscription.on('message', async (message) => {
        try {
            const data = JSON.parse(message.data.toString());
            logger.info('Received Event', { txnId: data.txnId });

            // 1. Audit Log (BigQuery)
            await logToBigQuery({
                txnId: data.txnId,
                userId: data.userId,
                amount: data.amount,
                action: data.action,
                riskScore: data.riskScore,
                timestamp: new Date().toISOString()
            });

            // 2. AML Cycle Detection (Neo4j)
            setTimeout(async () => {
                if (data.userId) {
                    const cycle = await detectCycle(data.userId);
                    if (cycle) {
                        logger.warn('AML CIRCULAR TRADING DETECTED', { cycle });
                        await generateSARReport(data, cycle);
                    }
                }
            }, 1000);

            message.ack();

        } catch (e) {
            logger.error('Error processing message', e);
            message.nack();
        }
    });

    subscription.on('error', (error) => {
        logger.error('Subscription Error', error);
    });

    // Keep alive
    setInterval(() => { }, 1000 * 60);
}

startWorker();
