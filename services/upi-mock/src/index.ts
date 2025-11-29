import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { SERVER_PUBLIC_KEY, SERVER_PRIVATE_KEY, decryptPayload, encryptPayload } from './crypto-utils';

const app = express();
const PORT = 5000; // UPI Mock Port

app.use(cors());
app.use(bodyParser.json());

console.log('[UPI Mock] Server Public Key:\n', SERVER_PUBLIC_KEY);

app.post('/api/v1/composite-payment', (req, res) => {
    try {
        const { encryptedKey, encryptedData, iv } = req.body;

        console.log('[UPI Mock] Received Encrypted Request');

        // 1. Decrypt
        const decryptedPayload = decryptPayload(encryptedKey, encryptedData, iv, SERVER_PRIVATE_KEY);
        console.log('[UPI Mock] Decrypted Payload:', decryptedPayload);

        // 2. Process (Mock Logic)
        const responsePayload = {
            status: 'SUCCESS',
            txnId: decryptedPayload['seq-no'] || 'txn_mock_123',
            message: 'Payment Processed Successfully via UPI Sandbox'
        };

        // 3. Encrypt Response (Using the same logic, effectively re-encrypting for the client)
        // In a real scenario, the client would have its own keypair, but for simplicity we'll use the server's key 
        // or just return plain for this specific mock if the spec allows. 
        // The spec says "Decrypt Response", implying the server sends it back encrypted.
        // We will use the same server public key to encrypt the response for the client to decrypt (Simulating client having the key).
        // Wait, usually server encrypts with CLIENT'S public key. 
        // For this mock, let's assume the client can decrypt what we encrypt with our public key (if they have the private key? No).
        // Let's just re-use the session key logic or keep it simple.

        // Simplified: We return the response encrypted with the SERVER_PUBLIC_KEY, 
        // assuming the test client has the SERVER_PRIVATE_KEY (which we export in the utils).
        // This is a shortcut for the prototype.
        const encryptedResponse = encryptPayload(responsePayload, SERVER_PUBLIC_KEY);

        res.json(encryptedResponse);

    } catch (error: any) {
        console.error('[UPI Mock] Error processing request:', error);
        res.status(500).json({ error: 'Decryption Failed or Internal Error' });
    }
});

app.listen(PORT, () => {
    console.log(`UPI Mock Service running on port ${PORT}`);
});
