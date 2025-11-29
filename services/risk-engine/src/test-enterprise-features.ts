import axios from 'axios';

const GATEWAY_URL = 'http://localhost:3000/v1/transaction/assess';

async function sendTxn(userId: string, merchantId: string, amount: number) {
    try {
        const res = await axios.post(GATEWAY_URL, {
            userId,
            receiverId: merchantId,
            amount,
            txnType: 'P2P'
        });
        // Wait for async processing (Gateway returns 202, but we want to see logs)
        await new Promise(r => setTimeout(r, 200));
        return res.data;
    } catch (error: any) {
        console.error(`Failed: ${error.message}`);
    }
}

async function runTests() {
    console.log('--- Testing Enterprise Features ---');

    // 1. Test Shadow Mode (MERCHANT_B = MONITOR)
    // Policy: Max Velocity = 2. We will send 3.
    // Expected: Risk Engine logs BLOCK, but Decision is ALLOW.
    console.log('\n1. Testing Shadow Mode (MERCHANT_B)...');
    const userShadow = 'user_shadow_1';
    await sendTxn(userShadow, 'MERCHANT_B', 100);
    await sendTxn(userShadow, 'MERCHANT_B', 100);
    await sendTxn(userShadow, 'MERCHANT_B', 100); // Should trigger Velocity Rule
    console.log('Check Risk Engine logs: Should say "Suppressing BLOCK"');

    // 2. Test Step-Up Auth (MERCHANT_A = PROTECT)
    // Policy: Max Amount = 20000. We send 25000.
    // Expected: CHALLENGE with challenge_url.
    console.log('\n2. Testing Step-Up Auth (MERCHANT_A)...');
    const userAuth = 'user_auth_1';
    // We can't easily see the response body here because Gateway returns 202.
    // We rely on Risk Engine logs to confirm "CHALLENGE" and "challenge_url".
    await sendTxn(userAuth, 'MERCHANT_A', 25000);
    console.log('Check Risk Engine logs: Should show CHALLENGE and challenge_url');

    // 3. Test Risk Memory
    // User with history.
    console.log('\n3. Testing Risk Memory...');
    // We rely on internal logs to see "historicalRiskScore".
    await sendTxn(userAuth, 'MERCHANT_A', 100);
}

runTests();
