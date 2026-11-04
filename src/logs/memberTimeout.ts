import { shouldBypassLogs } from '../utils/logBypass';
import { GuildMember, EmbedBuilder, TextChannel, ChannelType, AuditLogEvent } from 'discord.js';
import { ModBot } from '../types/ModBot';
import { formatDate } from '../utils/formatDate';

export default async (member: GuildMember, _oldTimeout: Date | null, newTimeout: Date | null) => {
    try {
        if (!newTimeout) return;

        const client = member.client as ModBot;
        const settings = client.settings;

        if (!settings.logs?.enabled || !settings.logs.memberTimeout?.enabled) return;

        const logChannelId = settings.logs.memberTimeout.channelId;
        if (!logChannelId) return;

        const logChannel = await client.channels.fetch(logChannelId) as TextChannel;
        if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

        const locale = client.locales.get(client.defaultLanguage)?.logs?.memberTimeout;
        if (!locale) {
            console.error(`Failed to find member timeout locale data for ${client.defaultLanguage}`);
            return;
        }

        const auditLogs = await member.guild.fetchAuditLogs({
            type: AuditLogEvent.MemberUpdate,
            limit: 1,
        });

        const timeoutLog = auditLogs.entries.find(entry =>
            entry.target?.id === member.id &&
            entry.changes?.some(change => change.key === 'communication_disabled_until')
        );
        const executor = timeoutLog?.executor;
        if (shouldBypassLogs(client, executor?.id)) return;

        const embed = new EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.memberTimeout.color as `#${string}`)
            .setThumbnail(member.user.displayAvatarURL({ size: 1024 }))
            .addFields(
                {
                    name: `👤 ${locale.member}`,
                    value: `${member.user.tag} (<@${member.id}>)`,
                    inline: true
                },
                {
                    name: `🤖 ${locale.bot}`,
                    value: member.user.bot ? locale.yes : locale.no,
                    inline: true
                },
                {
                    name: `⏰ ${locale.expires}`,
                    value: formatDate(newTimeout),
                    inline: true
                },
                {
                    name: `👮 ${locale.timedOutBy}`,
                    value: executor ? `${executor.tag} (<@${executor.id}>)` : locale.unknown,
                    inline: true
                },
                {
                    name: `📝 ${locale.reason}`,
                    value: timeoutLog?.reason || 'Automatic timeout (reason not provided by the moderator)',
                    inline: true
                }
            )
            .setFooter({ text: `${locale.memberId}: ${member.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error logging member timeout:', error);
    }
}; 
