import { shouldBypassLogs } from '../utils/logBypass';
import { GuildEmoji, EmbedBuilder, TextChannel, ChannelType, AuditLogEvent } from 'discord.js';
import { ModBot } from '../types/ModBot';

export default async (emoji: GuildEmoji) => {
    try {
        console.log('Emoji Delete Event Triggered:', emoji.name); // Debug log

        const client = emoji.client as ModBot;
        const settings = client.settings;

        if (!settings.logs?.enabled || !settings.logs.emojiDelete?.enabled) return;

        const logChannelId = settings.logs.emojiDelete.channelId;
        if (!logChannelId) return;

        const logChannel = await client.channels.fetch(logChannelId) as TextChannel;
        if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

        const locale = client.locales.get(client.defaultLanguage)?.logs?.emojiDelete;
        if (!locale) {
            console.error(`Failed to find emoji delete locale data for ${client.defaultLanguage}`);
            return;
        }

        const auditLogs = await emoji.guild.fetchAuditLogs({
            type: AuditLogEvent.EmojiDelete,
            limit: 1,
        });

        const deleteLog = auditLogs.entries.first();
        const executor = deleteLog?.executor;
        if (shouldBypassLogs(client, executor?.id)) return;

        const embed = new EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.emojiDelete.color as `#${string}`)
            .setThumbnail(emoji.url)
            .addFields(
                {
                    name: `📝 ${locale.name}`,
                    value: emoji.name || locale.unknown,
                    inline: true
                },
                {
                    name: `😀 ${locale.emoji}`,
                    value: `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`,
                    inline: true
                },
                {
                    name: `🎬 ${locale.animated}`,
                    value: emoji.animated ? locale.yes : locale.no,
                    inline: true
                },
                {
                    name: `👮 ${locale.deletedBy}`,
                    value: executor ? `${executor.tag} (<@${executor.id}>)` : locale.unknown,
                    inline: true
                }
            )
            .setFooter({ text: `${locale.emojiId}: ${emoji.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error logging emoji delete:', error);
    }
}; 
