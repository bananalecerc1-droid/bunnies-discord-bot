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

export default async (thread: ThreadChannel) => {
    try {
        const client = thread.client as ModBot;
        const settings = client.settings;

        if (!settings.logs?.enabled || !settings.logs.threadCreate?.enabled) return;

        const logChannelId = settings.logs.threadCreate.channelId;
        if (!logChannelId) return;

        const logChannel = await client.channels.fetch(logChannelId) as TextChannel;
        if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

        const locale = client.locales.get(client.defaultLanguage)?.logs?.threadCreate;
        if (!locale) {
            console.error(`Failed to find thread create locale data for ${client.defaultLanguage}`);
            return;
        }

        const auditLogs = await thread.guild.fetchAuditLogs({
            type: AuditLogEvent.ThreadCreate,
            limit: 1,
        });

        const createLog = auditLogs.entries.first();
        const executor = createLog?.executor;
        if (shouldBypassLogs(client, executor?.id)) return;

        const getThreadType = (type: ChannelType): string => {
            switch (type) {
                case ChannelType.PublicThread: return locale.types.public;
                case ChannelType.PrivateThread: return locale.types.private;
                case ChannelType.AnnouncementThread: return locale.types.announcement;
                default: return locale.types.unknown;
            }
        };

        const embed = new EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.threadCreate.color as `#${string}`)
            .addFields([
                {
                    name: `📝 ${locale.name}`,
                    value: thread.name,
                    inline: true
                },
                {
                    name: `📋 ${locale.type}`,
                    value: getThreadType(thread.type),
                    inline: true
                },
                {
                    name: `📁 ${locale.parent}`,
                    value: thread.parent ? thread.parent.name : locale.unknown,
                    inline: true
                },
                {
                    name: `⏰ ${locale.autoArchiveDuration}`,
                    value: formatArchiveDuration(thread.autoArchiveDuration, locale),
                    inline: true
                },
                {
                    name: `🐌 ${locale.slowMode}`,
                    value: thread.rateLimitPerUser ? `${thread.rateLimitPerUser}s` : locale.no,
                    inline: true
                },
                {
                    name: `🔒 ${locale.private}`,
                    value: thread.type === ChannelType.PrivateThread ? locale.yes : locale.no,
                    inline: true
                },
                {
                    name: `👤 ${locale.createdBy}`,
                    value: executor ? `${executor.tag} (${executor.id})` : locale.unknown,
                    inline: true
                }
            ])
            .setFooter({ text: `${locale.threadId}: ${thread.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error logging thread create:', error);
    }
};
