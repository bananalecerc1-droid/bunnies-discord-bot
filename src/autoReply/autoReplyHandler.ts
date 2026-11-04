import { Message } from 'discord.js';
import { ModBot } from '../types/ModBot';

interface AutoReplySection {
    enabled: boolean;
    triggers: string[];
    responses: string[];
}

interface AutoReplySettings {
    enabled: boolean;
    mentionUser: boolean;
    replyToMessage: boolean;
    channels: { enabled: string[]; disabled: string[] };
    roles: { enabled: string[]; disabled: string[] };
    sections: { [key: string]: AutoReplySection };
    matchType: 'exact' | 'includes' | 'startsWith' | 'endsWith' | 'regex';
    caseSensitive: boolean;
    chance: number;
    cooldown: number;
}

const cooldowns = new Map<string, { [key: string]: number }>();

export const handleAutoReply = async (message: Message): Promise<void> => {
    const client = message.client as ModBot;
    const settings = (client.settings?.autoReply || {}) as Partial<AutoReplySettings>;

    try {
        if (!settings.enabled || !message.guild || message.author.bot) return;
        if (!message.channel.isSendable()) return;

        const channels = settings.channels || { enabled: [], disabled: [] };
        const roles = settings.roles || { enabled: [], disabled: [] };
        const sections = settings.sections || {};
        const channelId = message.channel.id;

        if (channels.enabled.length > 0 && !channels.enabled.includes(channelId)) return;
        if (channels.disabled.includes(channelId)) return;
        if (roles.enabled.length > 0 && !message.member?.roles.cache.some(role => roles.enabled.includes(role.id))) return;
        if (message.member?.roles.cache.some(role => roles.disabled.includes(role.id))) return;

        const now = Date.now();
        const cooldown = Number(settings.cooldown) || 0;
        const chance = Math.max(0, Math.min(100, Number(settings.chance ?? 100)));
        const matchType = settings.matchType || 'includes';
        const userCooldowns = cooldowns.get(message.author.id) || {};

        for (const [sectionName, section] of Object.entries(sections)) {
            if (!section?.enabled || !Array.isArray(section.triggers) || !Array.isArray(section.responses) || section.responses.length === 0) continue;
            if (userCooldowns[sectionName] && now - userCooldowns[sectionName] < cooldown) continue;

            const matches = section.triggers.some((trigger: string) => {
                const content = settings.caseSensitive ? message.content : message.content.toLowerCase();
                const triggerText = settings.caseSensitive ? trigger : trigger.toLowerCase();
                switch (matchType) {
                    case 'exact': return content === triggerText;
                    case 'startsWith': return content.startsWith(triggerText);
                    case 'endsWith': return content.endsWith(triggerText);
                    case 'regex':
                        try { return new RegExp(triggerText).test(content); } catch { return false; }
                    case 'includes':
                    default: return content.includes(triggerText);
                }
            });
            if (!matches || Math.random() * 100 > chance) continue;

            const response = section.responses[Math.floor(Math.random() * section.responses.length)];
            const content = settings.mentionUser ? `${message.author} ${response}` : response;
            if (settings.replyToMessage) await message.reply({ content });
            else await message.channel.send({ content });

            userCooldowns[sectionName] = now;
            cooldowns.set(message.author.id, userCooldowns);
            console.log(`[auto-reply] matched section: ${sectionName}`);
            break;
        }
    } catch (error) {
        console.error('Error handling auto reply:', error);
    }
};
