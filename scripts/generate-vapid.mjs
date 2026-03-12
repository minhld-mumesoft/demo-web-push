import webpush from "web-push";

const subject = process.argv[2] ?? "mailto:your-email@example.com";
const { publicKey, privateKey } = webpush.generateVAPIDKeys();

process.stdout.write(`Add these values to .env.local:

VAPID_SUBJECT=${subject}
NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}
VAPID_PRIVATE_KEY=${privateKey}

Tip: pass a subject explicitly, for example:
npm run generate:vapid -- mailto:you@example.com
`);
