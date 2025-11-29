import axios from 'axios';

async function test() {
    try {
        console.log('Testing AI Service Direct...');
        const res = await axios.post('http://localhost:6000/v1/ai/predict', { userId: 'TestUser_123' });
        console.log('Response:', res.data);
    } catch (e: any) {
        console.error('Error:', e.message);
        if (e.response) console.error('Data:', e.response.data);
    }
}

test();
