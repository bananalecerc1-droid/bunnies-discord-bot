import 'dotenv/config';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const rawToken = process.env.DISCORD_BOT_TOKEN || process.env.token || '';

if (!rawToken.trim()) {
    console.error(
        '[config] DISCORD_BOT_TOKEN is missing or empty.\n' +
        '  - If you use a .env file, make sure it sits next to config.ts (or dist/config.js after build) and contains:\n' +
        '      DISCORD_BOT_TOKEN=your-bot-token-here\n' +
        '  - If you run this under PM2, either add DISCORD_BOT_TOKEN to an ecosystem.config.js "env" block,\n' +
        '    or export it in the shell BEFORE `pm2 start`/`pm2 restart` (pm2 does not re-read your shell env on restart\n' +
        '    unless you pass --update-env).'
    );
}

const config: BotConfig = {
    token: rawToken.trim().replace(/^Bot\s+/i, '').replace(/^['"]|['"]$/g, ''),
    clientId: process.env.DISCORD_CLIENT_ID || process.env.clientId || '',
    tursoUrl: process.env.TURSO_DATABASE_URL || process.env.tursoUrl || 'file:local.db',
    tursoAuthToken: process.env.TURSO_AUTH_TOKEN || process.env.tursoAuthToken || '',
    defaultPrefix: process.env.DEFAULT_PREFIX || process.env.defaultPrefix || '!',
    mainGuildId: process.env.MAIN_GUILD_ID || process.env.mainGuildId || '1461079149245632577',
    defaultLanguage: 'en',
    dashboard: {
        port: Number(process.env.PORT || 5000)
    }
};

export interface BotConfig {
    token: string;
    clientId: string;
    tursoUrl: string;
    tursoAuthToken: string;
    defaultPrefix: string;
    mainGuildId: string;
    defaultLanguage: string;
    dashboard: {
        port: number;
    };
}

function loadSettingsFile(): any {
    let settingsPath = join(__dirname, 'settings.json');
    
    if (!existsSync(settingsPath)) {
        settingsPath = join(__dirname, '../settings.json');
        
        if (!existsSync(settingsPath)) {
            settingsPath = join(process.cwd(), 'settings.json');
            
            if (!existsSync(settingsPath)) {
                const defaultSettings = {
                    defaultLanguage: "en",
                    logs: {},
                    protection: {
                        enabled: true,
                        modules: {}
                    }
                };
                
                writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 4), 'utf8');
                console.log(`Created default settings file at ${settingsPath}`);
                return defaultSettings;
            }
        }
    }
    
    try {
        console.log(`Loading settings from: ${settingsPath}`);
        const rawSettings = readFileSync(settingsPath, 'utf-8');

        if (!rawSettings.trim()) {
            const generatedSettingsPath = join(process.cwd(), 'dist', 'settings.json');

            if (existsSync(generatedSettingsPath)) {
                const generatedSettings = readFileSync(generatedSettingsPath, 'utf-8');
                if (generatedSettings.trim()) {
                    const settings = JSON.parse(generatedSettings);
                    writeFileSync(settingsPath, generatedSettings, 'utf8');
                    console.warn(`Restored empty settings file from ${generatedSettingsPath}`);
                    return settings;
                }
            }

            const defaultSettings = {
                defaultLanguage: "en",
                logs: {},
                protection: {
                    enabled: true,
                    modules: {}
                }
            };

            writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 4), 'utf8');
            console.warn(`Replaced empty settings file with defaults at ${settingsPath}`);
            return defaultSettings;
        }

        const settings = JSON.parse(rawSettings);
        return settings;
    } catch (error) {
        console.error(`Error reading settings file: ${error}`);
        throw new Error('Failed to load settings.json file');
    }
}
const settings = loadSettingsFile();

export default {
    ...config,
    ...settings,
    token: config.token,
    clientId: config.clientId,
    tursoUrl: config.tursoUrl,
    tursoAuthToken: config.tursoAuthToken,
    defaultPrefix: config.defaultPrefix,
    mainGuildId: config.mainGuildId,
    dashboard: config.dashboard
};