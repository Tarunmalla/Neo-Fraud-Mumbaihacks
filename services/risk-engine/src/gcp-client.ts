import { PubSub } from '@google-cloud/pubsub';

const KEY_PATH = 'D:\\MUMBAI\\mumbaihacks-1-b626f1941eb6.json';
const PROJECT_ID = 'mumbaihacks-1';

export const pubsub = new PubSub({
    projectId: PROJECT_ID,
    keyFilename: KEY_PATH
});

export const TOPIC_NAME = 'transaction-events';
