import axios from 'axios';

const GATEWAY_URL = 'http://localhost:3000/v1/transaction/assess';

async function sendTxn(from: string, to: string, amount: number, scenario: string) {
    try {
        console.log(`[${scenario}] Sending: ${from} -> ${to} ($${amount})`);
        await axios.post(GATEWAY_URL, {
            userId: from,
            receiverId: to,
            amount: amount,
            txnType: 'P2P'
        }, {
            headers: { 'x-api-key': 'test-api-key-123' }
        });
        // Small delay to ensure order in async processing (though Redis queue usually preserves it)
        await new Promise(r => setTimeout(r, 500));
    } catch (error: any) {
        console.error(`Failed to send txn: ${error.message}`);
    }
}

async function runScenarios() {
    console.log('--- Starting AML Scenarios ---\n');

    // Scenario 1: The "Launderer Ring" (A -> B -> C -> A)
    // Expected: Alert on the last transaction.
    console.log('--- Scenario 1: 3-Node Ring ---');
    await sendTxn('Launderer1', 'Launderer2', 5000, 'Ring');
    await sendTxn('Launderer2', 'Launderer3', 4800, 'Ring');
    await sendTxn('Launderer3', 'Launderer1', 4500, 'Ring'); // Cycle!

    // Scenario 2: The "Ping Pong" (X -> Y -> X)
    // Expected: Alert on the last transaction.
    console.log('\n--- Scenario 2: Ping Pong ---');
    await sendTxn('TraderX', 'TraderY', 10000, 'PingPong');
    await sendTxn('TraderY', 'TraderX', 10000, 'PingPong'); // Cycle!

    // Scenario 3: The "Family" (Fan Out / Feed Forward) - VALID
    // Dad -> Mom, Dad -> Son, Mom -> Son. No return to Dad.
    // Expected: NO Alert.
    console.log('\n--- Scenario 3: Family (Valid) ---');
    await sendTxn('Dad', 'Mom', 1000, 'Family');
    await sendTxn('Dad', 'Son', 500, 'Family');
    await sendTxn('Mom', 'Son', 200, 'Family');

    console.log('\n--- Scenarios Completed. Checking for SAR files... ---');
}

runScenarios();
