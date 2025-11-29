const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { SERVER_PUBLIC_KEY, SERVER_PRIVATE_KEY, decryptPayload, encryptPayload } = require('./crypto-utils');

const app = express();
const PORT = 5000;

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
        let paymentType = 'UNKNOWN';
        let txnId = 'txn_mock_' + Date.now();

        if (decryptedPayload['payee-va']) {
            paymentType = 'UPI';
            txnId = decryptedPayload['seq-no'] || txnId;
        } else if (decryptedPayload['txnType'] === 'RGS' || decryptedPayload['TXNTYPE'] === 'RTG') {
            paymentType = 'RTGS/NEFT';
            txnId = decryptedPayload['tranRefNo'] || decryptedPayload['URN'] || txnId;
        } else if (decryptedPayload['paymentRef'] === 'FTTransferP2A') {
            paymentType = 'IMPS';
            txnId = decryptedPayload['tranRefNo'] || txnId;
        }

        console.log(`[Mock] Detected Payment Type: ${paymentType}`);

        const responsePayload = {
            status: 'SUCCESS',
            txnId: txnId,
            paymentType: paymentType,
            message: `Payment Processed Successfully via ${paymentType} Sandbox`
        };

        // 3. Encrypt Response
        const encryptedResponse = encryptPayload(responsePayload, SERVER_PUBLIC_KEY);

        res.json(encryptedResponse);

    } catch (error) {
        console.error('[UPI Mock] Error processing request:', error);
        res.status(500).json({ error: 'Decryption Failed or Internal Error' });
    }
});

app.listen(PORT, () => {
    console.log(`UPI Mock Service running on port ${PORT}`);
});
