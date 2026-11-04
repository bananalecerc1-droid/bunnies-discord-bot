import { shouldBypassLogs } from '../utils/logBypass';
import { VoiceState, EmbedBuilder, TextChannel, ChannelType, AuditLogEvent } from 'discord.js';
import { ModBot } from '../types/ModBot';

export default async (oldState: VoiceState, newState: VoiceState) => {
    try {
        if (!oldState.channelId || !newState.channelId || oldState.channelId === newState.channelId) return;

        const client = newState.client as ModBot;
        const settings = client.settings;

        if (!settings.logs?.enabled || !settings.logs.voiceMove?.enabled) return;

        const logChannelId = settings.logs.voiceMove.channelId;
        if (!logChannelId) return;

        const logChannel = await client.channels.fetch(logChannelId) as TextChannel;
        if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

        const locale = client.locales.get(client.defaultLanguage)?.logs?.voiceMove;
        if (!locale) {
            console.error(`Failed to find voice move locale data for ${client.defaultLanguage}`);
            return;
        }

        const auditLogs = await newState.guild.fetchAuditLogs({
            type: AuditLogEvent.MemberMove,
            limit: 1,
        });

        const moveLog = auditLogs.entries.first();
        const executor = moveLog?.executor;
        if (shouldBypassLogs(client, executor?.id)) return;

        const embed = new EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.voiceMove.color as `#${string}`)
            .addFields([
                {
                    name: `👤 ${locale.member}`,
                    value: `${newState.member?.user.tag} (<@${newState.member?.id}>)`,
                    inline: true
                },
                {
                    name: `📤 ${locale.oldChannel}`,
                    value: `${oldState.channel?.name} (<#${oldState.channelId}>)`,
                    inline: true
                },
                {
                    name: `📥 ${locale.newChannel}`,
                    value: `${newState.channel?.name} (<#${newState.channelId}>)`,
                    inline: true
                },
                {
                    name: `👮 ${locale.movedBy}`,
                    value: executor ? `${executor.tag} (<@${executor.id}>)` : locale.unknown,
                    inline: true
                }
            ])
            .setFooter({ text: `${locale.memberId}: ${newState.member?.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error logging voice move:', error);
    }
}; 
