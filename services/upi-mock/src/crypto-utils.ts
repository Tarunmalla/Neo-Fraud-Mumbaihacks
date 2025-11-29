import forge from 'node-forge';

// --- RSA Key Generation (Mock) ---
// In reality, these would be provided by NPCI/Bank
const keypair = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
export const SERVER_PUBLIC_KEY = forge.pki.publicKeyToPem(keypair.publicKey);
export const SERVER_PRIVATE_KEY = forge.pki.privateKeyToPem(keypair.privateKey);

// --- Encryption Utils ---

/**
 * Encrypts payload using the NPCI Sandbox logic:
 * 1. Generate 16-byte Session Key
 * 2. Encrypt Session Key with RSA Public Key
 * 3. Encrypt Data with AES-CBC using Session Key and IV
 */
export function encryptPayload(data: any, publicKeyPem: string) {
    const sessionKey = forge.random.getBytesSync(16);
    const iv = forge.random.getBytesSync(16);

    // 1. Encrypt Session Key (RSA)
    const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
    // @ts-ignore
    const encryptedKeyPKCS1 = publicKey.encrypt(sessionKey, 'RSAES-PKCS1-V1_5');

    // 2. Encrypt Data (AES-CBC)
    const cipher: any = forge.cipher.createCipher('AES-CBC', sessionKey);
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

/**
 * Decrypts payload using the NPCI Sandbox logic.
 */
export function decryptPayload(encryptedKeyB64: string, encryptedDataB64: string, ivB64: string, privateKeyPem: string) {
    // 1. Decrypt Session Key (RSA)
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
    const encryptedKey = forge.util.decode64(encryptedKeyB64);
    // @ts-ignore
    const sessionKey = privateKey.decrypt(encryptedKey, 'RSAES-PKCS1-V1_5');

    // 2. Decrypt Data (AES-CBC)
    const iv = forge.util.decode64(ivB64);
    const encryptedData = forge.util.decode64(encryptedDataB64);

    const decipher: any = forge.cipher.createDecipher('AES-CBC', sessionKey);
    decipher.start({ iv: iv });
    decipher.update(forge.util.createBuffer(encryptedData));
    decipher.finish();

    return JSON.parse(decipher.output.toString());
}
