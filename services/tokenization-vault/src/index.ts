import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = 4001; // Running on a separate port (Secure Enclave)

app.use(cors());
app.use(bodyParser.json());

// Mock HSM Storage (In-Memory for Prototype)
// In production, this would be a secure database or actual HSM
const tokenMap = new Map<string, string>(); // Token -> PAN
const reverseMap = new Map<string, string>(); // PAN -> Token

app.post('/v1/tokenize', (req, res) => {
    const { pan } = req.body;

    if (!pan) {
        return res.status(400).json({ error: 'PAN is required' });
    }

    // Check if already tokenized
    if (reverseMap.has(pan)) {
        return res.json({ token: reverseMap.get(pan) });
    }

    // Generate new token (Format: tok_xxxx)
    const token = `tok_${uuidv4().split('-')[0]}`;

    tokenMap.set(token, pan);
    reverseMap.set(pan, token);

    console.log(`[Vault] Tokenized PAN ending in ${pan.slice(-4)} -> ${token}`);
    res.json({ token });
});

app.post('/v1/detokenize', (req, res) => {
    const { token } = req.body;

    if (!token || !tokenMap.has(token)) {
        return res.status(404).json({ error: 'Invalid Token' });
    }

    const pan = tokenMap.get(token);
    console.log(`[Vault] Detokenized ${token} -> PAN ending in ${pan?.slice(-4)}`);

    res.json({ pan });
});

app.listen(PORT, () => {
    console.log(`Tokenization Vault (Secure Zone) running on port ${PORT}`);
});
