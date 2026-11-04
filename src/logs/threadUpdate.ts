import { shouldBypassLogs } from '../utils/logBypass';
import { ThreadChannel, EmbedBuilder, TextChannel, ChannelType, AuditLogEvent } from 'discord.js';
import { ModBot } from '../types/ModBot';

const formatArchiveDuration = (duration: number | null, locale: any): string => {
    if (!duration) return locale.unknown;
    
    switch (duration) {
        case 60:
            return `1 ${locale.hour || 'hour'}`;
        case 1440:
            return `1 ${locale.day || 'day'}`;
        case 4320:
            return `3 ${locale.days || 'days'}`;
        case 10080:
            return `7 ${locale.days || 'days'}`;
        default:
            return `${duration} ${locale.minutes}`;
    }
};

export default async (oldThread: ThreadChannel, newThread: ThreadChannel) => {
    try {
        const client = oldThread.client as ModBot;
        const settings = client.settings;

        if (!settings.logs?.enabled || !settings.logs.threadUpdate?.enabled) return;

        const logChannelId = settings.logs.threadUpdate.channelId;
        if (!logChannelId) return;

        const logChannel = await client.channels.fetch(logChannelId) as TextChannel;
        if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

        const locale = client.locales.get(client.defaultLanguage)?.logs?.threadUpdate;
        if (!locale) {
            console.error(`Failed to find thread update locale data for ${client.defaultLanguage}`);
            return;
        }

        const auditLogs = await oldThread.guild.fetchAuditLogs({
            type: AuditLogEvent.ThreadUpdate,
            limit: 1,
        });

        const updateLog = auditLogs.entries.first();
        const executor = updateLog?.executor;
        if (shouldBypassLogs(client, executor?.id)) return;

        const getThreadType = (type: ChannelType): string => {
            switch (type) {
                case ChannelType.PublicThread: return locale.types.public;
                case ChannelType.PrivateThread: return locale.types.private;
                case ChannelType.AnnouncementThread: return locale.types.announcement;
                default: return locale.types.unknown;
            }
        };

        const fields = [];

        if (oldThread.name !== newThread.name) {
            fields.push({
                name: `📝 ${locale.name}`,
                value: `${locale.before}: ${oldThread.name}\n${locale.after}: ${newThread.name}`,
                inline: false
            });
        }

        if (oldThread.autoArchiveDuration !== newThread.autoArchiveDuration) {
            fields.push({
                name: `⏰ ${locale.autoArchiveDuration}`,
                value: `${locale.before}: ${formatArchiveDuration(oldThread.autoArchiveDuration, locale)}\n${locale.after}: ${formatArchiveDuration(newThread.autoArchiveDuration, locale)}`,
                inline: false
            });
        }

        if (oldThread.rateLimitPerUser !== newThread.rateLimitPerUser) {
            fields.push({
                name: `🐌 ${locale.slowMode}`,
                value: `${locale.before}: ${oldThread.rateLimitPerUser || '0'}s\n${locale.after}: ${newThread.rateLimitPerUser || '0'}s`,
                inline: false
            });
        }

        if (oldThread.archived !== newThread.archived) {
            fields.push({
                name: `📦 ${locale.archived}`,
                value: `${locale.before}: ${oldThread.archived ? locale.yes : locale.no}\n${locale.after}: ${newThread.archived ? locale.yes : locale.no}`,
                inline: false
            });
        }

        if (oldThread.locked !== newThread.locked) {
            fields.push({
                name: `🔒 ${locale.locked}`,
                value: `${locale.before}: ${oldThread.locked ? locale.yes : locale.no}\n${locale.after}: ${newThread.locked ? locale.yes : locale.no}`,
                inline: false
            });
        }

        if (oldThread.type === ChannelType.PrivateThread && 
            newThread.type === ChannelType.PrivateThread && 
            oldThread.invitable !== newThread.invitable) {
            fields.push({
                name: `✉️ ${locale.invitable}`,
                value: `${locale.before}: ${oldThread.invitable ? locale.yes : locale.no}\n${locale.after}: ${newThread.invitable ? locale.yes : locale.no}`,
                inline: false
            });
        }

        if (oldThread.type !== newThread.type) {
            fields.push({
                name: `📋 ${locale.type}`,
                value: `${locale.before}: ${getThreadType(oldThread.type)}\n${locale.after}: ${getThreadType(newThread.type)}`,
                inline: false
            });
        }

        if (fields.length > 0) {
            const embed = new EmbedBuilder()
                .setTitle(locale.title)
                .setDescription(locale.description)
                .setColor(settings.logs.threadUpdate.color as `#${string}`)
                .addFields([
                    ...fields,
                    {
                        name: `👤 ${locale.updatedBy}`,
                        value: executor ? `${executor.tag} (${executor.id})` : locale.unknown,
                        inline: false
                    }
                ])
                .setFooter({ text: `${locale.threadId}: ${newThread.id}` })
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Error logging thread update:', error);
    }
}; 
