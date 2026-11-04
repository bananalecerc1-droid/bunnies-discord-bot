# Bunnies Discord Bot

A TypeScript Discord moderation bot with protection systems, moderation commands, leveling, tickets, dashboard, logging, and server tools.

## Requirements

- Node.js 20 or newer
- Discord application credentials
- Turso/libSQL credentials

## Run

```bash
cp .env.example .env
# Edit .env with your real credentials
npm ci
npm run build:start
```

Required variables are `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `TURSO_DATABASE_URL`, and `TURSO_AUTH_TOKEN`. Set environment variables directly in your hosting provider for production. Never commit `.env` or real credentials.
