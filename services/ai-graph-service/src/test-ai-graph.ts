import axios from 'axios';

const GATEWAY_URL = 'http://localhost:3000/v1/transaction/assess';

async function sendTxn(from: string, to: string, amount: number) {
    try {
        await axios.post(GATEWAY_URL, {
            userId: from,
            receiverId: to,
            amount: amount,
            txnType: 'P2P'
        });
        // Small delay
        await new Promise(r => setTimeout(r, 200));
    } catch (error: any) {
        console.error(`Failed to send txn: ${error.message}`);
    }
}

async function runTest() {
    console.log('--- Testing AI Graph Mule Detection ---');

    const muleAccount = 'Mule_Account_X';

    // 1. Create a "Fan-In" pattern (Many users -> Mule)
    // This increases the Degree Centrality of the Mule Account.
    console.log('1. Generating Fan-In Transactions...');
    for (let i = 1; i <= 15; i++) {
        await sendTxn(`Victim_${i}`, muleAccount, 1000);
    }

    console.log('2. Waiting for Graph Updates...');
    await new Promise(r => setTimeout(r, 2000));

    // 2. Assess the Mule Account
    // Sending a transaction FROM the Mule should now trigger the AI Rule.
    console.log('3. Assessing Mule Account Risk...');
    try {
        const response = await axios.post(GATEWAY_URL, {
            userId: muleAccount,
            receiverId: 'Cashout_Point',
            amount: 50000
        });

        console.log('Response:', response.data);
        // We expect status: 'PENDING' (202), but the Risk Engine logs should show CHALLENGE/BLOCK.

    } catch (e) {
        console.error(e);
    }
}

runTest();
