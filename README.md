This is a Next.js web push demo that uses VAPID keys and an in-memory subscription store.

## Getting Started

Generate a VAPID key pair and copy the output into `.env.local`:

```bash
npm run generate:vapid -- mailto:you@example.com
```

The app expects these environment variables:

```bash
VAPID_SUBJECT=mailto:you@example.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

Then run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), allow notifications, and use the page to subscribe the current browser and send test push messages.

## Available Scripts

- `npm run dev` starts the local Next.js dev server.
- `npm run build` creates a production build.
- `npm run start` serves the production build.
- `npm run lint` runs ESLint.
- `npm run generate:vapid -- mailto:you@example.com` generates a VAPID key pair for local setup.

## Notes

- Subscriptions are stored in memory, so restarting the server clears them.
- The generated public key must stay in sync with `NEXT_PUBLIC_VAPID_PUBLIC_KEY` used by the browser.
- Use a `mailto:` or `https:` subject for `VAPID_SUBJECT`.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [web-push documentation](https://github.com/web-push-libs/web-push)
