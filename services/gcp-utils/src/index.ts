import { BigQuery } from '@google-cloud/bigquery';
import { PubSub } from '@google-cloud/pubsub';
import { VertexAI } from '@google-cloud/vertexai';
import path from 'path';

// Hardcoded for this environment as per user instructions
const KEY_PATH = 'D:\\MUMBAI\\mumbaihacks-1-b626f1941eb6.json';
const PROJECT_ID = 'mumbaihacks-1'; // Extracted from filename/user context
const LOCATION = 'us-central1'; // Default for Vertex AI

console.log(`[GCP Utils] Initializing clients with key: ${KEY_PATH}`);

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

export * from './logger';

