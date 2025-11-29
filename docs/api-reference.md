# Fintech Platform API Reference

This document summarizes every HTTP-facing surface exposed by the fintech platform services, along with authentication requirements and example invocations. Internal queue workers (risk-engine, post-auth-worker, webhook-service, etc.) have no inbound HTTP APIs and are therefore documented only at a high level.

## Network Topology & Exposure

| Service | Purpose | Base URL (default) | Exposure | Auth |
| --- | --- | --- | --- | --- |
| Gateway | Public ingress for transaction submissions & health probes | `http://34.14.156.36` (LoadBalancer) | Internet-facing | HMAC headers on `/v1/transaction/assess` |
| AI Graph Service | Graph enrichment & fraud-score inference | `http://localhost:9600` _(via `kubectl port-forward deployment/ai-graph-service 9600:6000`)_ | Cluster-only (ClusterIP) | None |
| Tokenization Vault | PAN ↔ token operations for the secure enclave | `http://localhost:4001` (runs alongside secure infra) | Private subnet/host-only | None |
| UPI Mock | Simulated encrypted UPI composite-payment processor | `http://localhost:5000` | Private subnet/host-only | Encrypted payload (hybrid RSA+AES) |

> ℹ️ To reach cluster-internal services from your workstation, open a tunnel first. Example: `kubectl port-forward deployment/ai-graph-service 9600:6000`.

## 1. Gateway Service

**Base URL:** `http://34.14.156.36`

### 1.1 `GET /health`
- **Purpose:** Kubernetes/LB health check.
- **Auth:** None
- **Response:** `{ "status": "OK" }`

```bash
curl -X GET http://34.14.156.36/health
```

### 1.2 `POST /v1/transaction/assess`
- **Purpose:** Submit a transaction for asynchronous risk evaluation.
- **Auth:** HMAC SHA-256 using the shared secret per client.
- **Headers:**
  - `x-client-id`: e.g. `mumbai-hacks-client-001`
  - `x-timestamp`: Unix epoch milliseconds. Requests older/newer than ±5 minutes are rejected.
  - `x-signature`: Hex digest of `HMAC_SHA256(secret, timestamp + method + path + body)`
- **Body:** JSON payload describing the transaction. The gateway is schema-agnostic; include keys such as `amount`, `currency`, `merchantId`, `userId`, etc.
- **Response:** `202 Accepted` with `{ txnId, status: "PENDING", message }`

#### Bash sample (`openssl`):
```bash
CLIENT_ID="mumbai-hacks-client-001"
SECRET="hmac-secret-8f7d2b3c4d5e6f7a8b9c0d1e2f3a4b5c"
TIMESTAMP=$(python - <<<'import time; print(int(time.time()*1000))')
METHOD="POST"
PATH="/v1/transaction/assess"
BODY='{ "amount": 2500, "currency": "INR", "merchantId": "demo-merchant", "paymentMethod": "CARD", "cardNumber": "4111111111111111" }'
SIGN_INPUT="$TIMESTAMP$METHOD$PATH$BODY"
SIGNATURE=$(printf %s "$SIGN_INPUT" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

curl -X POST "http://34.14.156.36$PATH" \
  -H "Content-Type: application/json" \
  -H "x-client-id: $CLIENT_ID" \
  -H "x-timestamp: $TIMESTAMP" \
  -H "x-signature: $SIGNATURE" \
  -d "$BODY"
```

#### PowerShell sample:
```powershell
$clientId = "mumbai-hacks-client-001"
$secret = "hmac-secret-8f7d2b3c4d5e6f7a8b9c0d1e2f3a4b5c"
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
$method = "POST"
$path = "/v1/transaction/assess"
$body = '{"amount":13500,"currency":"USD","merchantId":"remote-test","paymentMethod":"UPI"}'
$stringToSign = "$timestamp$method$path$body"
$hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($secret))
$signature = ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($stringToSign)) | ForEach-Object { $_.ToString("x2") }) -join ''

curl.exe -X POST "http://34.14.156.36$path" \
  -H "Content-Type: application/json" \
  -H "x-client-id: $clientId" \
  -H "x-timestamp: $timestamp" \
  -H "x-signature: $signature" \
  -d $body
```

## 2. AI Graph Service

**Base URL:** `http://localhost:9600` after running `kubectl port-forward deployment/ai-graph-service 9600:6000`.

### 2.1 `POST /v1/ai/predict`
- **Purpose:** Return a heuristic fraud score for a user based on Neo4j in-degree.
- **Body:** `{ "userId": "user-123" }`
- **Response:** `{ "fraudScore": 0.0-1.0 }`

```bash
kubectl port-forward deployment/ai-graph-service 9600:6000 >/tmp/ai.forward.log &
PORT_FWD_PID=$!
sleep 2
curl -X POST http://localhost:9600/v1/ai/predict \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-123"}'
kill $PORT_FWD_PID
```

### 2.2 `POST /v1/graph/update`
- **Purpose:** Ingest sender/receiver relationships into Neo4j.
- **Body:** `{ "senderId": "user-a", "receiverId": "user-b", "amount": 4200, "txnId": "abc-123" }`
- **Response:** `{ "status": "Graph Updated" }`

```bash
curl -X POST http://localhost:9600/v1/graph/update \
  -H "Content-Type: application/json" \
  -d '{"senderId":"user-a","receiverId":"user-b","amount":4200,"txnId":"abc-123"}'
```

## 3. Tokenization Vault

**Base URL:** `http://localhost:4001`

### 3.1 `POST /v1/tokenize`
- **Body:** `{ "pan": "4111111111111111" }`
- **Response:** `{ "token": "tok_abcd" }`

```bash
curl -X POST http://localhost:4001/v1/tokenize \
  -H "Content-Type: application/json" \
  -d '{"pan":"4111111111111111"}'
```

### 3.2 `POST /v1/detokenize`
- **Body:** `{ "token": "tok_abcd" }`
- **Response:** `{ "pan": "4111111111111111" }`

```bash
curl -X POST http://localhost:4001/v1/detokenize \
  -H "Content-Type: application/json" \
  -d '{"token":"tok_abcd"}'
```

## 4. UPI Mock Service

**Base URL:** `http://localhost:5000`

### 4.1 `POST /api/v1/composite-payment`
- **Purpose:** Accepts an encrypted UPI payload and returns an encrypted success response.
- **Request Schema:** `{ encryptedKey, encryptedData, iv }` — produced by `encryptPayload` in `services/upi-mock/src/crypto-utils.*` using the published `SERVER_PUBLIC_KEY`.
- **Response Schema:** `{ encryptedKey, encryptedData, iv }` — decrypt with `decryptPayload`.

Because the payload uses hybrid RSA/AES, the easiest way to exercise this endpoint is via the provided Node test harness:

```bash
cd services/upi-mock
npm install
npx ts-node src/test-upi.ts
```

The script prints the original JSON, encrypted request snippets, and the decrypted server response (`{"status":"SUCCESS", ...}`).

## 5. Non-HTTP Services

| Service | Interaction Pattern | How to Test |
| --- | --- | --- |
| Risk Engine | Consumes Redis list `transaction_queue`, publishes to Pub/Sub `transaction-events` and Redis channels `transaction_result:<txnId>` | Push mock jobs via `redis-cli LPUSH transaction_queue '{...}'` (port-forward `redis` first) and follow `kubectl logs deployment/risk-engine -f` |
| Post-Auth Worker | Subscribes to Pub/Sub `transaction-events-sub`, writes BigQuery, Neo4j, Vertex AI, Discord | Publish to Pub/Sub via `gcloud pubsub topics publish transaction-events --message '{...}'` or trigger via gateway ➔ risk engine ➔ Pub/Sub pipeline |
| Webhook Service | Redis pattern subscription `transaction_result:*`, posts signed callbacks to merchant webhook URLs | Use Redis `PUBLISH transaction_result:demo '{...}'` while port-forwarding Redis to observe outbound webhook attempts in logs |

## 6. Useful Port-Forward Recipes

```bash
# Gateway (if you want to bypass the LoadBalancer during testing)
kubectl port-forward deployment/gateway 9300:3000

# Redis
kubectl port-forward svc/redis 6379:6379

# Neo4j HTTP + Bolt
kubectl port-forward svc/neo4j 7474:7474 7687:7687
```

Keep this document alongside the repo (saved as `docs/api-reference.md`) so it stays versioned with the codebase.
