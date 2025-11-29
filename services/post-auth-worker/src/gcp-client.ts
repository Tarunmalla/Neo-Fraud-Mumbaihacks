import { BigQuery } from '@google-cloud/bigquery';
import { PubSub } from '@google-cloud/pubsub';
import { VertexAI } from '@google-cloud/vertexai';

const KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || '/etc/gcp/key.json';
const PROJECT_ID = 'mumbaihacks-1';
const LOCATION = 'us-central1';

export const bigquery = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: KEY_PATH
});

export const pubsub = new PubSub({
    projectId: PROJECT_ID,
    keyFilename: KEY_PATH
});

export const vertexAI = new VertexAI({
    project: PROJECT_ID,
    location: LOCATION,
    googleAuthOptions: {
        keyFile: KEY_PATH
    }
});

export const TOPIC_NAME = 'transaction-events';
export const SUBSCRIPTION_NAME = 'transaction-events-sub';
export const DATASET_ID = 'fintech_audit_logs';
export const TABLE_ID = 'transactions';
