import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface DeviceSignals {
    deviceId: string;
    ip: string;
    userAgent: string;
    screenResolution: string;
    batteryLevel: number;
}

export class ProtectiveLayerSDK {
    private gatewayUrl: string;

    constructor(gatewayUrl: string = 'http://localhost:3000/v1/transaction/assess') {
        this.gatewayUrl = gatewayUrl;
    }

    /**
     * Collects device telemetry signals.
     */
    public collectSignals(): any {
        return {
            deviceId: uuidv4(),
            ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
            userAgent: 'Mozilla/5.0 (Mobile; Android 10)',
            screenResolution: '1080x2400',
            batteryLevel: Math.floor(Math.random() * 100) / 100,
            // Phase 8: Biometric Signals
            // 1.0 = Perfect/Bot, 0.0 = Shaky. Human is usually 0.7-0.95.
            gyroscope_stability: 0.85,
            typing_cadence: Math.floor(Math.random() * 200) + 50 // ms
        };
    }

    public async assessTransaction(userId: string, amount: number): Promise<any> {
        const signals = this.collectSignals();
        const payload = {
            userId,
            amount,
            ...signals
        };

        try {
            const response = await axios.post(this.gatewayUrl, payload);
            return response.data;
        } catch (error: any) {
            throw error.response?.data || error.message;
        }
    }
}

// --- Usage Example (Self-Executing if run directly) ---
if (require.main === module) {
    (async () => {
        const sdk = new ProtectiveLayerSDK();
        console.log('--- Running SDK Example ---');
        try {
            const result = await sdk.assessTransaction('user_example', 500);
            console.log('Result:', result);
        } catch (err) {
            console.error('Error:', err);
        }
    })();
}

