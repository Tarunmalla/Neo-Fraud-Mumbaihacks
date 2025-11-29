import { bigquery, pubsub, TOPIC_NAME, SUBSCRIPTION_NAME, DATASET_ID, TABLE_ID } from './index';

async function setup() {
    console.log('--- Setting up GCP Resources ---');

    // 1. Pub/Sub Topic
    try {
        const [topic] = await pubsub.createTopic(TOPIC_NAME);
        console.log(`Topic ${topic.name} created.`);
    } catch (e: any) {
        if (e.code === 6) console.log(`Topic ${TOPIC_NAME} already exists.`);
        else console.error('Error creating topic:', e);
    }

    // 2. Pub/Sub Subscription
    try {
        const [subscription] = await pubsub.topic(TOPIC_NAME).createSubscription(SUBSCRIPTION_NAME);
        console.log(`Subscription ${subscription.name} created.`);
    } catch (e: any) {
        if (e.code === 6) console.log(`Subscription ${SUBSCRIPTION_NAME} already exists.`);
        else console.error('Error creating subscription:', e);
    }

    // 3. BigQuery Dataset
    try {
        const [dataset] = await bigquery.createDataset(DATASET_ID);
        console.log(`Dataset ${dataset.id} created.`);
    } catch (e: any) {
        if (e.code === 409) console.log(`Dataset ${DATASET_ID} already exists.`);
        else console.error('Error creating dataset:', e);
    }

    // 4. BigQuery Table
    try {
        const schema = [
            { name: 'txnId', type: 'STRING' },
            { name: 'userId', type: 'STRING' },
            { name: 'amount', type: 'FLOAT' },
            { name: 'action', type: 'STRING' },
            { name: 'riskScore', type: 'FLOAT' },
            { name: 'timestamp', type: 'TIMESTAMP' }
        ];
        const [table] = await bigquery.dataset(DATASET_ID).createTable(TABLE_ID, { schema });
        console.log(`Table ${table.id} created.`);
    } catch (e: any) {
        if (e.code === 409) console.log(`Table ${TABLE_ID} already exists.`);
        else console.error('Error creating table:', e);
    }

    console.log('--- Setup Complete ---');
}

setup();
