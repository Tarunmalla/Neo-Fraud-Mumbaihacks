const axios = require('axios');
const { encryptPayload, decryptPayload, SERVER_PUBLIC_KEY, SERVER_PRIVATE_KEY } = require('./crypto-utils');

const UPI_MOCK_URL = 'http://localhost:5000/api/v1/composite-payment';

async function testUpiFlow() {
    console.log('--- Starting UPI Mock Test ---');

    const payload = {
        "device-id": "400438400438400438400431",
        "mobile": "7988000014",
        "channel-code": "MICICI",
        "seq-no": "TXN_TEST_001",
        "payee-va": "merchant@icici",
        "payer-va": "user@icici",
        "amount": "100.00",
        "txn-type": "merchantToPersonPay"
    };

    console.log('1. Original Payload:', payload);

    // 1. Encrypt Payload (Client Side)
    const encryptedRequest = encryptPayload(payload, SERVER_PUBLIC_KEY);
    console.log('2. Encrypted Request (Sending to Mock):', {
        encryptedKey: encryptedRequest.encryptedKey.substring(0, 20) + '...',
        encryptedData: encryptedRequest.encryptedData.substring(0, 20) + '...'
    });

    try {
        // 2. Send to Mock Service
        const response = await axios.post(UPI_MOCK_URL, encryptedRequest);
        const encryptedResponse = response.data;

        console.log('3. Received Encrypted Response:', {
            encryptedKey: encryptedResponse.encryptedKey.substring(0, 20) + '...',
            encryptedData: encryptedResponse.encryptedData.substring(0, 20) + '...'
        });

        // 3. Decrypt Response (Client Side)
        const decryptedResponse = decryptPayload(
            encryptedResponse.encryptedKey,
            encryptedResponse.encryptedData,
            encryptedResponse.iv,
            SERVER_PRIVATE_KEY
        );

        console.log('4. Decrypted Response:', decryptedResponse);

    } catch (error) {
        console.error('Test Failed:', error.response?.data || error.message);
    }
}

testUpiFlow();
