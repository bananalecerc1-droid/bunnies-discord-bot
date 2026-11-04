import { watchFile, readFileSync } from 'fs';
import { join } from 'path';
import { ModBot } from '../types/ModBot';

export class SettingsWatcher {
    private settingsPath: string;
    private lastContent: string;

    constructor(private client: ModBot) {
        this.settingsPath = join(process.cwd(), 'settings.json');
        this.lastContent = readFileSync(this.settingsPath, 'utf8');
        this.updateSettings(this.lastContent);
    }

    private updateSettings(content: string): void {
        try {
            const newSettings = JSON.parse(content);
            this.client.settings = newSettings;

            if (newSettings.defaultLanguage !== this.client.defaultLanguage) {
                this.client.defaultLanguage = newSettings.defaultLanguage;
            }

            this.client.aliases.clear();
            for (const [commandName, command] of this.client.commands) {
                if (newSettings.commands?.[commandName]?.aliases) {
                    newSettings.commands[commandName].aliases.forEach((alias: string) => {
                        this.client.aliases.set(String(alias).trim().toLowerCase(), commandName);
                    });
                }
                
                if (command.command) {
                    command.command.enabled = newSettings.commands?.[commandName]?.enabled ?? true;
                }
            }

            delete require.cache[require.resolve('../../settings.json')];
            console.log('Settings reloaded successfully');
        } catch (error) {
            console.error('Error updating settings:', error);
        }
    }

    public start(): void {
        watchFile(this.settingsPath, { interval: 1000 }, () => {
            try {
                const currentContent = readFileSync(this.settingsPath, 'utf8');
                if (currentContent !== this.lastContent) {
                    this.updateSettings(currentContent);
                    this.lastContent = currentContent;
                }
            } catch (error) {
                console.error('Error in settings watcher:', error);
            }
        });
    }

    public stop(): void {
        try {
            const { unwatchFile } = require('fs');
            unwatchFile(this.settingsPath);
        } catch (error) {
            console.error('Error stopping settings watcher:', error);
        }
    }
}
