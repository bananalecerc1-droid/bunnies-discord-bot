import { GuildMember, EmbedBuilder, TextChannel, ChannelType } from 'discord.js';
import { ModBot } from '../types/ModBot';
import { formatDate } from '../utils/formatDate';

export default async (member: GuildMember) => {
    try {
        const client = member.client as ModBot;
        const settings = client.settings;

        if (!settings.logs?.enabled || !settings.logs.memberJoin?.enabled) return;

        const logChannelId = settings.logs.memberJoin.channelId;
        if (!logChannelId) return;

        const logChannel = await client.channels.fetch(logChannelId) as TextChannel;
        if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

        const locale = client.locales.get(client.defaultLanguage)?.logs?.memberJoin;
        if (!locale) {
            console.error(`Failed to find member join locale data for ${client.defaultLanguage}`);
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.memberJoin.color as `#${string}`)
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
                    name: `📅 ${locale.accountCreated}`,
                    value: formatDate(member.user.createdAt),
                    inline: true
                },
                {
                    name: `⌚ ${locale.joinedAt}`,
                    value: formatDate(new Date()),
                    inline: true
                },
                {
                    name: `👥 ${locale.memberCount}`,
                    value: member.guild.memberCount.toString(),
                    inline: true
                }
            )
            .setFooter({ text: `${locale.memberId}: ${member.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error logging member join:', error);
    }
}; 
