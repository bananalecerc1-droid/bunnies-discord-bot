import { shouldBypassLogs } from '../utils/logBypass';
import { Sticker, EmbedBuilder, TextChannel, ChannelType, AuditLogEvent } from 'discord.js';
import { ModBot } from '../types/ModBot';

export default async (sticker: Sticker) => {
    try {
        const client = sticker.client as ModBot;
        const settings = client.settings;

        if (!settings.logs?.enabled || !settings.logs.stickerCreate?.enabled) return;

        console.log('Sticker Create Event Triggered:', sticker.name); // Debug log

        const logChannelId = settings.logs.stickerCreate.channelId;
        if (!logChannelId) return;

        const logChannel = await client.channels.fetch(logChannelId) as TextChannel;
        if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

        const locale = client.locales.get(client.defaultLanguage)?.logs?.stickerCreate;
        if (!locale) {
            console.error(`Failed to find sticker create locale data for ${client.defaultLanguage}`);
            return;
        }

        const auditLogs = await sticker.guild?.fetchAuditLogs({
            type: AuditLogEvent.StickerCreate,
            limit: 1,
        });

        const createLog = auditLogs?.entries.first();
        const executor = createLog?.executor;
        if (shouldBypassLogs(client, executor?.id)) return;

        const embed = new EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.stickerCreate.color as `#${string}`)
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
                    name: `✅ ${locale.available}`,
                    value: sticker.available ? locale.yes : locale.no,
                    inline: true
                },
                {
                    name: `👮 ${locale.createdBy}`,
                    value: executor ? `${executor.tag} (<@${executor.id}>)` : locale.unknown,
                    inline: true
                }
            )
            .setFooter({ text: `${locale.stickerId}: ${sticker.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error logging sticker create:', error);
    }
}; 
