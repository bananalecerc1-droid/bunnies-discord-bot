import { shouldBypassLogs } from '../utils/logBypass';
import { Sticker, EmbedBuilder, TextChannel, ChannelType, AuditLogEvent } from 'discord.js';
import { ModBot } from '../types/ModBot';

export default async (sticker: Sticker) => {
    try {
        const client = sticker.client as ModBot;
        const settings = client.settings;

        if (!settings.logs?.enabled || !settings.logs.stickerDelete?.enabled) return;

        console.log('Sticker Delete Event Triggered:', sticker.name); // Debug log

        const logChannelId = settings.logs.stickerDelete.channelId;
        if (!logChannelId) return;

        const logChannel = await client.channels.fetch(logChannelId) as TextChannel;
        if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

        const locale = client.locales.get(client.defaultLanguage)?.logs?.stickerDelete;
        if (!locale) {
            console.error(`Failed to find sticker delete locale data for ${client.defaultLanguage}`);
            return;
        }

        const auditLogs = await sticker.guild?.fetchAuditLogs({
            type: AuditLogEvent.StickerDelete,
            limit: 1,
        });

        const deleteLog = auditLogs?.entries.first();
        const executor = deleteLog?.executor;
        if (shouldBypassLogs(client, executor?.id)) return;

        const embed = new EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.stickerDelete.color as `#${string}`)
            .setThumbnail(sticker.url)
            .addFields(
                {
                    name: `📝 ${locale.name}`,
                    value: sticker.name || locale.unknown,
                    inline: true
                },
                {
                    name: `📋 ${locale.description}`,
                    value: sticker.description || locale.unknown,
                    inline: true
                },
                {
                    name: `🏷️ ${locale.tags}`,
                    value: sticker.tags || locale.unknown,
                    inline: true
                },
                {
                    name: `📁 ${locale.format}`,
                    value: sticker.format.toString(),
                    inline: true
                },
                {
                    name: `👮 ${locale.deletedBy}`,
                    value: executor ? `${executor.tag} (<@${executor.id}>)` : locale.unknown,
                    inline: true
                }
            )
            .setFooter({ text: `${locale.stickerId}: ${sticker.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error logging sticker delete:', error);
    }
}; 
