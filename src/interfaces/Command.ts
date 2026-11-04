import { ChatInputCommandInteraction, Message } from 'discord.js';

export interface Command {
    name: string;
    aliases?: string[];
    enabled: boolean;
    execute: (interaction: ChatInputCommandInteraction | Message, args: string[], client: any) => Promise<void>;
    isSlashCommand?: boolean;
} 
