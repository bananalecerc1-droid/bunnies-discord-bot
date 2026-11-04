import { shouldBypassLogs } from '../utils/logBypass';
import { GuildEmoji, EmbedBuilder, TextChannel, ChannelType, AuditLogEvent } from 'discord.js';
import { ModBot } from '../types/ModBot';

export default async (emoji: GuildEmoji) => {
    try {
        const client = emoji.client as ModBot;
        const settings = client.settings;

        if (!settings.logs?.enabled || !settings.logs.emojiCreate?.enabled) return;

        console.log('Emoji Create Event Triggered:', emoji.name);
        console.log('Emoji create event triggered');

        const logChannelId = settings.logs.emojiCreate.channelId;
        if (!logChannelId) return;

        const logChannel = await client.channels.fetch(logChannelId) as TextChannel;
        if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

        const locale = client.locales.get(client.defaultLanguage)?.logs?.emojiCreate;
        if (!locale) {
            console.error(`Failed to find emoji create locale data for ${client.defaultLanguage}`);
            return;
        }

        const auditLogs = await emoji.guild.fetchAuditLogs({
            type: AuditLogEvent.EmojiCreate,
            limit: 1,
        });

        const createLog = auditLogs.entries.first();
        const executor = createLog?.executor;
        if (shouldBypassLogs(client, executor?.id)) return;

        const embed = new EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.emojiCreate.color as `#${string}`)
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
                    name: `👮 ${locale.createdBy}`,
                    value: executor ? `${executor.tag} (<@${executor.id}>)` : locale.unknown,
                    inline: true
                }
            )
            .setFooter({ text: `${locale.emojiId}: ${emoji.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error logging emoji create:', error);
    }
}; 
