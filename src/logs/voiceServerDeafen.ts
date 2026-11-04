import { shouldBypassLogs } from '../utils/logBypass';
import { VoiceState, EmbedBuilder, TextChannel, ChannelType, AuditLogEvent } from 'discord.js';
import { ModBot } from '../types/ModBot';

export default async (oldState: VoiceState, newState: VoiceState) => {
    try {
        if (oldState.serverDeaf === newState.serverDeaf) return;

        const client = newState.client as ModBot;
        const settings = client.settings;

        if (!settings.logs?.enabled || !settings.logs.voiceServerDeafen?.enabled) return;

        const logChannelId = settings.logs.voiceServerDeafen.channelId;
        if (!logChannelId) return;

        const logChannel = await client.channels.fetch(logChannelId) as TextChannel;
        if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

        const locale = client.locales.get(client.defaultLanguage)?.logs?.voiceServerDeafen;
        if (!locale) {
            console.error(`Failed to find voice server deafen locale data for ${client.defaultLanguage}`);
            return;
        }

        const auditLogs = await newState.guild.fetchAuditLogs({
            type: AuditLogEvent.MemberUpdate,
            limit: 1,
        });

        const deafenLog = auditLogs.entries.first();
        const executor = deafenLog?.executor;
        if (shouldBypassLogs(client, executor?.id)) return;

        const embed = new EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.voiceServerDeafen.color as `#${string}`)
            .addFields([
                {
                    name: `👤 ${locale.member}`,
                    value: `${newState.member?.user.tag} (<@${newState.member?.id}>)`,
                    inline: true
                },
                {
                    name: `🔊 ${locale.channel}`,
                    value: newState.channel ? `${newState.channel.name} (<#${newState.channelId}>)` : locale.unknown,
                    inline: true
                },
                {
                    name: `🔇 ${locale.status}`,
                    value: newState.serverDeaf ? locale.deafened : locale.undeafened,
                    inline: true
                },
                {
                    name: `👮 ${locale.deafenedBy}`,
                    value: executor ? `${executor.tag} (<@${executor.id}>)` : locale.unknown,
                    inline: true
                }
            ])
            .setFooter({ text: `${locale.memberId}: ${newState.member?.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error logging voice server deafen:', error);
    }
}; 
