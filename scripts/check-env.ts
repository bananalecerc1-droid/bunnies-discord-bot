import 'dotenv/config';

const required = ['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID'];
const missing = required.filter((key) => !process.env[key] || !process.env[key]?.trim());

if (missing.length) {
    console.error(`❌ Missing required environment variable(s): ${missing.join(', ')}`);
    console.error('   Set them in bot/.env (copy from .env.example) or in your process manager\'s env config.');
    process.exit(1);
}

console.log('✅ Required environment variables are present');
