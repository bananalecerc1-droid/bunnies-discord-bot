import { shouldBypassLogs } from '../utils/logBypass';
import { GuildBan, EmbedBuilder, TextChannel, ChannelType, AuditLogEvent } from 'discord.js';
import { ModBot } from '../types/ModBot';

export default async (ban: GuildBan) => {
    try {
        const client = ban.client as ModBot;
        const settings = client.settings;

        if (!settings.logs?.enabled || !settings.logs.memberUnban?.enabled) return;

        const logChannelId = settings.logs.memberUnban.channelId;
        if (!logChannelId) return;

        const logChannel = await client.channels.fetch(logChannelId) as TextChannel;
        if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

        const locale = client.locales.get(client.defaultLanguage)?.logs?.memberUnban;
        if (!locale) {
            console.error(`Failed to find member unban locale data for ${client.defaultLanguage}`);
            return;
        }

        const auditLogs = await ban.guild.fetchAuditLogs({
            type: AuditLogEvent.MemberBanRemove,
            limit: 1,
        });

        const unbanLog = auditLogs.entries.first();
        const executor = unbanLog?.executor;
        if (shouldBypassLogs(client, executor?.id)) return;

        const embed = new EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.memberUnban.color as `#${string}`)
            .setThumbnail(ban.user.displayAvatarURL({ size: 1024 }))
            .addFields(
                {
                    name: `👤 ${locale.member}`,
                    value: `${ban.user.tag} (<@${ban.user.id}>)`,
                    inline: true
                },
                {
                    name: `👮 ${locale.unbannedBy}`,
                    value: executor ? `${executor.tag} (<@${executor.id}>)` : locale.unknown,
                    inline: true
                },
                {
                    name: `📝 ${locale.reason}`,
                    value: unbanLog?.reason || locale.noReason,
                    inline: true
                }
            )
            .setFooter({ text: `${locale.memberId}: ${ban.user.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error logging member unban:', error);
    }
}; 
