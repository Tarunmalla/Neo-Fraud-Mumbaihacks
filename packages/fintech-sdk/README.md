# @mumbai-hacks/fintech-sdk

A lightweight JavaScript/TypeScript SDK for calling the Fintech Protective Layer gateway from any application server. It bundles:

- an `FintechClient` wrapper that signs requests with the mandated HMAC headers
- a drop-in Express middleware to proxy incoming transactions through the gateway
- helper utilities for health checks and custom signing flows

## Installation

```bash
npm install @mumbai-hacks/fintech-sdk
# or
yarn add @mumbai-hacks/fintech-sdk
```

> The Express middleware is optional. If you plan to use it, ensure `express` is installed in the host project.

## Usage

### 1. Core Client

```ts
import { FintechClient } from '@mumbai-hacks/fintech-sdk';

const fintech = new FintechClient({
  clientId: process.env.FINTECH_CLIENT_ID!,
  secretKey: process.env.FINTECH_SECRET!,
  baseURL: process.env.FINTECH_BASE_URL ?? 'http://34.14.156.36'
});

const response = await fintech.assessTransaction({
  userId: 'user-42',
  amount: 5000,
  currency: 'INR',
  merchantId: 'demo-merchant'
});
```

### 2. Express Middleware

```ts
import express from 'express';
import { FintechClient, createAssessmentMiddleware } from '@mumbai-hacks/fintech-sdk';

const app = express();
app.use(express.json());

const client = new FintechClient({ clientId: 'client', secretKey: 'secret' });

app.post('/transactions', createAssessmentMiddleware({
  client,
  mapRequest: (req) => ({
    userId: req.body.user?.id,
    amount: req.body.amount,
    currency: req.body.currency ?? 'INR',
    merchantId: req.body.merchantId ?? 'default'
  }),
  autoRespond: false
}), (req, res) => {
  // use res.locals.fintechAssessment for downstream logic
  res.json({ status: 'forwarded', gateway: res.locals.fintechAssessment });
});
```

### 3. Health Check

```ts
const isHealthy = await client.health();
```

## Building & Publishing

```bash
cd packages/fintech-sdk
npm install
npm run build
npm publish --access public
```

The compiled artifacts live in `dist/` and only that folder is published, keeping the package lean.
