import { FintechClient } from '@mumbai-hacks/fintech-sdk';

async function main() {
    console.log('--- Fintech SDK Demo (HMAC) ---');

    // 1. Valid Scenario
    console.log('\n[Test 1] Using Valid Credentials...');
    const client = new FintechClient(
        'mumbai-hacks-client-001',
        'hmac-secret-8f7d2b3c4d5e6f7a8b9c0d1e2f3a4b5c',
        'http://34.14.156.36'
    );

    try {
        const response = await client.assessTransaction({
            userId: 'SDK_User_1',
            amount: 5000,
            currency: 'INR',
            merchantId: 'Demo_Merchant'
        });
        console.log('✅ Transaction Accepted:', response);
    } catch (e: any) {
        console.error('❌ Failed:', e.message);
    }

    // 2. Invalid Scenario (Wrong Secret)
    console.log('\n[Test 2] Using Invalid Secret...');
    const badClient = new FintechClient(
        'mumbai-hacks-client-001',
        'wrong-secret-key',
        'http://34.14.156.36'
    );

    try {
        await badClient.assessTransaction({
            userId: 'SDK_User_2',
            amount: 100,
            currency: 'INR',
            merchantId: 'Demo_Merchant'
        });
        console.log('✅ Success (Unexpected)');
    } catch (e: any) {
        console.log('✅ Expected Failure:', e.message);
    }
}

main();
