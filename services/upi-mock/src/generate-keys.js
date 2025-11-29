const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

const KEY_FILE = path.join(__dirname, 'keys.json');

if (!fs.existsSync(KEY_FILE)) {
    console.log('Generating new RSA Key Pair...');
    const keypair = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
    const keys = {
        publicKey: forge.pki.publicKeyToPem(keypair.publicKey),
        privateKey: forge.pki.privateKeyToPem(keypair.privateKey)
    };
    fs.writeFileSync(KEY_FILE, JSON.stringify(keys, null, 2));
    console.log('Keys saved to keys.json');
} else {
    console.log('keys.json already exists. Skipping generation.');
}
