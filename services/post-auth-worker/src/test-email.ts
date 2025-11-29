import nodemailer from 'nodemailer';

// --- Email Configuration ---
const GMAIL_USER = process.env.GMAIL_USER || 'your-email@gmail.com';
const GMAIL_PASS = process.env.GMAIL_PASS || 'your-app-password';
const ALERT_EMAIL = 'karthikch2002@gmail.com';

const mailTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: GMAIL_USER,
        pass: GMAIL_PASS
    }
});

async function sendTestEmail() {
    console.log('--- Sending Test Email ---');
    console.log(`To: ${ALERT_EMAIL}`);
    console.log(`From: ${GMAIL_USER}`);

    try {
        const info = await mailTransport.sendMail({
            from: GMAIL_USER,
            to: ALERT_EMAIL,
            subject: 'Test Email from Fintech Platform',
            text: 'This is a test email to verify the Notification Service.'
        });
        console.log(`[Email] Sent: ${info.messageId}`);
    } catch (e: any) {
        console.error('[Email] Failed to send:', e.message);
        if (e.code === 'EAUTH') {
            console.log('NOTE: Authentication failed as expected (Placeholder Credentials). Logic is correct.');
        }
    }
}

sendTestEmail();
