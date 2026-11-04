import { shouldBypassLogs } from '../utils/logBypass';
import { GuildMember, PartialGuildMember, EmbedBuilder, TextChannel, ChannelType, AuditLogEvent } from 'discord.js';
import { ModBot } from '../types/ModBot';

export default async (member: GuildMember | PartialGuildMember) => {
    try {
        const client = member.client as ModBot;
        const settings = client.settings;

        const fullMember = member.partial ? await member.fetch() : member;

        if (!settings.logs?.enabled || !settings.logs.memberKick?.enabled) return;

        const logChannelId = settings.logs.memberKick.channelId;
        if (!logChannelId) return;

        const logChannel = await client.channels.fetch(logChannelId) as TextChannel;
        if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

        const locale = client.locales.get(client.defaultLanguage)?.logs?.memberKick;
        if (!locale) {
            console.error(`Failed to find member kick locale data for ${client.defaultLanguage}`);
            return;
        }

        const auditLogs = await fullMember.guild.fetchAuditLogs({
            type: AuditLogEvent.MemberKick,
            limit: 1,
        });

        const kickLog = auditLogs.entries.first();
        const executor = kickLog?.executor;
        if (shouldBypassLogs(client, executor?.id)) return;

        const embed = new EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.memberKick.color as `#${string}`)
            .setThumbnail(fullMember.user.displayAvatarURL({ size: 1024 }))
            .addFields(
                {
                    name: `👤 ${locale.member}`,
                    value: `${fullMember.user.tag} (<@${fullMember.id}>)`,
                    inline: true
                },
                {
                    name: `🤖 ${locale.bot}`,
                    value: fullMember.user.bot ? locale.yes : locale.no,
                    inline: true
                },
                {
                    name: `👮 ${locale.kickedBy}`,
                    value: executor ? `${executor.tag} (<@${executor.id}>)` : locale.unknown,
                    inline: true
                },
                {
                    name: `📝 ${locale.reason}`,
                    value: kickLog?.reason || locale.noReason,
                    inline: true
                }
            )
            .setFooter({ text: `${locale.memberId}: ${fullMember.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error logging member kick:', error);
    }
}; 
