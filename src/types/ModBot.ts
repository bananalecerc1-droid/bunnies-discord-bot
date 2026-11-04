import { Client, Collection } from 'discord.js';

export interface ModBot extends Client {
    commands: Collection<string, any>;
    aliases: Collection<string, string>;
    locales: Collection<string, any>;
    defaultLanguage: string;
    settings: any;
    getLocale(guildLocale: string): string;
    reloadSettings(): void;
} 
