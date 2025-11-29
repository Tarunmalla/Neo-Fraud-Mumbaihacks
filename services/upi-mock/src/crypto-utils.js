const forge = require('node-forge');

const fs = require('fs');
const path = require('path');

const KEY_FILE = path.join(__dirname, 'keys.json');

if (!fs.existsSync(KEY_FILE)) {
    throw new Error('keys.json not found! Run generate-keys.js first.');
}

const keys = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
const SERVER_PUBLIC_KEY = keys.publicKey;
const SERVER_PRIVATE_KEY = keys.privateKey;

// --- Encryption Utils ---
function encryptPayload(data, publicKeyPem) {
    const sessionKey = forge.random.getBytesSync(16);
    const iv = forge.random.getBytesSync(16);

    // 1. Encrypt Session Key (RSA)
    const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
    const encryptedKeyPKCS1 = publicKey.encrypt(sessionKey, 'RSAES-PKCS1-V1_5');

    // 2. Encrypt Data (AES-CBC)
    const cipher = forge.cipher.createCipher('AES-CBC', sessionKey);
    cipher.start({ iv: iv });
    cipher.update(forge.util.createBuffer(JSON.stringify(data), 'utf8'));
    cipher.finish();
    const encryptedData = cipher.output.getBytes();

    return {
        encryptedKey: forge.util.encode64(encryptedKeyPKCS1),
        encryptedData: forge.util.encode64(encryptedData),
        iv: forge.util.encode64(iv)
    };
}

function decryptPayload(encryptedKeyB64, encryptedDataB64, ivB64, privateKeyPem) {
    // 1. Decrypt Session Key (RSA)
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
    const encryptedKey = forge.util.decode64(encryptedKeyB64);
    const sessionKey = privateKey.decrypt(encryptedKey, 'RSAES-PKCS1-V1_5');

    // 2. Decrypt Data (AES-CBC)
    const iv = forge.util.decode64(ivB64);
    const encryptedData = forge.util.decode64(encryptedDataB64);

    const decipher = forge.cipher.createDecipher('AES-CBC', sessionKey);
    decipher.start({ iv: iv });
    decipher.update(forge.util.createBuffer(encryptedData));
    decipher.finish();

    return JSON.parse(decipher.output.toString());
}

module.exports = {
    SERVER_PUBLIC_KEY,
    SERVER_PRIVATE_KEY,
    encryptPayload,
    decryptPayload
};
