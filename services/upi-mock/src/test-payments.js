const axios = require('axios');
const { encryptPayload, decryptPayload, SERVER_PUBLIC_KEY, SERVER_PRIVATE_KEY } = require('./crypto-utils');

const MOCK_URL = 'http://localhost:5000/api/v1/composite-payment';

async function sendPayment(name, payload) {
    console.log(`\n--- Testing ${name} ---`);
    try {
        // Encrypt
        const encryptedRequest = encryptPayload(payload, SERVER_PUBLIC_KEY);

        // Send
        const response = await axios.post(MOCK_URL, encryptedRequest);
        const encryptedResponse = response.data;

        // Decrypt
        const decryptedResponse = decryptPayload(
            encryptedResponse.encryptedKey,
            encryptedResponse.encryptedData,
            encryptedResponse.iv,
            SERVER_PRIVATE_KEY
        );

        console.log(`[${name}] Response:`, decryptedResponse);
    } catch (error) {
        console.error(`[${name}] Failed:`, error.message);
    }
}

async function runTests() {
    // 1. UPI Payload
    await sendPayment('UPI', {
        "device-id": "400438400438400438400431",
        "mobile": "7988000014",
        "channel-code": "MICICI",
        "seq-no": "UPI_TEST_001",
        "payee-va": "merchant@icici",
        "payer-va": "user@icici",
        "amount": "100.00",
        "txn-type": "merchantToPersonPay"
    });

    // 2. NEFT Payload (Example 1 from User)
    await sendPayment('NEFT', {
        "tranRefNo": "NEFT_TEST_001",
        "amount": "1",
        "senderAcctNo": "000451000301",
        "beneAccNo": "000405002777",
        "beneName": "SNS",
        "beneIFSC": "SBIN0003060",
        "txnType": "RGS", // User example used RGS for what looked like NEFT context or maybe generic
        "WORKFLOW_REQD": "N"
    });

    // 3. IMPS Payload (Example 2 from User)
    await sendPayment('IMPS', {
        "localTxnDtTime": "20230705201210",
        "beneAccNo": "123456172",
        "beneIFSC": "NPCI0000092",
        "amount": "91",
        "tranRefNo": "IMPS_TEST_001",
        "paymentRef": "FTTransferP2A",
        "senderName": "Pratik Mundhe92",
        "mobile": "9999988979"
    });

    // 4. RTGS Payload (Example 3 from User)
    await sendPayment('RTGS', {
        "AGGRID": "AGG0001",
        "URN": "RTGS_TEST_001",
        "UNIQUEID": "ICI01234",
        "DEBITACC": "000405001611",
        "CREDITACC": "000405002777",
        "IFSC": "ICIC0000004",
        "AMOUNT": "100000",
        "TXNTYPE": "RTG",
        "PAYEENAME": "ASDAS"
    });
}

runTests();
