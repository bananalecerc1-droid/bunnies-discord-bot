import { GuildBan, EmbedBuilder, TextChannel, ChannelType } from 'discord.js';
import { ModBot } from '../types/ModBot';

export default async (ban: GuildBan) => {
    try {
        const client = ban.client as ModBot;
        const settings = client.settings;

        if (!settings.logs?.enabled || !settings.logs.memberBan?.enabled) return;

        const logChannelId = settings.logs.memberBan.channelId;
        if (!logChannelId) return;

        const logChannel = await client.channels.fetch(logChannelId) as TextChannel;
        if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

        const locale = client.locales.get(client.defaultLanguage)?.logs?.memberBan;
        if (!locale) {
            console.error(`Failed to find member ban locale data for ${client.defaultLanguage}`);
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.memberBan.color as `#${string}`)
            .setThumbnail(ban.user.displayAvatarURL({ size: 1024 }))
            .addFields(
                {
                    name: `👤 ${locale.member}`,
                    value: `${ban.user.tag} (<@${ban.user.id}>)`,
                    inline: true
                },
                {
                    name: `🤖 ${locale.bot}`,
                    value: ban.user.bot ? locale.yes : locale.no,
                    inline: true
                },
                {
                    name: `📝 ${locale.reason}`,
                    value: ban.reason || locale.noReason,
                    inline: true
                }
            )
            .setFooter({ text: `${locale.memberId}: ${ban.user.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error logging member ban:', error);
    }
}; 
