import { shouldBypassLogs } from '../utils/logBypass';
import { ThreadChannel, EmbedBuilder, TextChannel, ChannelType, AuditLogEvent } from 'discord.js';
import { ModBot } from '../types/ModBot';

export default async (thread: ThreadChannel) => {
    try {
        const client = thread.client as ModBot;
        const settings = client.settings;

        if (!settings.logs?.enabled || !settings.logs.threadDelete?.enabled) return;

        const logChannelId = settings.logs.threadDelete.channelId;
        if (!logChannelId) return;

        const logChannel = await client.channels.fetch(logChannelId) as TextChannel;
        if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

        const locale = client.locales.get(client.defaultLanguage)?.logs?.threadDelete;
        if (!locale) {
            console.error(`Failed to find thread delete locale data for ${client.defaultLanguage}`);
            return;
        }

        const auditLogs = await thread.guild.fetchAuditLogs({
            type: AuditLogEvent.ThreadDelete,
            limit: 1,
        });

        const deleteLog = auditLogs.entries.first();
        const executor = deleteLog?.executor;
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
            .setColor(settings.logs.threadDelete.color as `#${string}`)
            .addFields(
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
                    name: `👥 ${locale.memberCount}`,
                    value: thread.memberCount?.toString() || '0',
                    inline: true
                },
                {
                    name: `💬 ${locale.messageCount}`,
                    value: thread.messageCount?.toString() || '0',
                    inline: true
                },
                {
                    name: `👤 ${locale.deletedBy}`,
                    value: executor ? `${executor.tag} (${executor.id})` : locale.unknown,
                    inline: true
                }
            )
            .setFooter({ text: `${locale.threadId}: ${thread.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error logging thread delete:', error);
    }
}; 
