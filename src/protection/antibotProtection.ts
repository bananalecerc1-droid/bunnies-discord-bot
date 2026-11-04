import { GuildMember, EmbedBuilder, TextChannel, ChannelType, User } from 'discord.js';
import { ModBot } from '../types/ModBot';

export const handleBotAdd = async (bot: GuildMember, executor: GuildMember) => {
    const client = bot.client as ModBot;
    const settings = client.settings;

    if (!settings.protection.enabled || settings.protection.antibot.enabled === false) return;

    try {
        if (executor.roles.cache.some(role => 
            settings.protection.antibot.action.ignoredRoles.includes(role.id)
        )) return;

        if (settings.protection.antibot.whitelistedBots.includes(bot.id)) return;

        await takeAction(executor, settings.protection.antibot.action.reason);

        await sendProtectionLog(client, executor, bot.user);

        await bot.kick('Bot not whitelisted');
    } catch (error) {
        console.error('Error in antibot protection:', error);
    }
};

const takeAction = async (member: GuildMember, reason: string) => {
    const client = member.client as ModBot;
    const settings = client.settings;
    const { action } = settings.protection.antibot;

    try {
        switch (action.type) {
            case 'removeRoles':
                const roles = member.roles.cache.filter(role => 
                    !role.managed && role.editable && !action.ignoredRoles.includes(role.id)
                );
                if (roles.size > 0) await member.roles.remove(roles, reason);
                break;
            case 'kick':
                await member.kick(reason);
                break;
            case 'ban':
                await member.ban({ 
                    reason,
                    deleteMessageSeconds: action.duration || undefined 
                });
                break;
        }
    } catch (error) {
        console.error('Error taking protection action:', error);
    }
};

const sendProtectionLog = async (client: ModBot, member: GuildMember, bot: User) => {
    const settings = client.settings;
    try {
        if (!settings.protection?.logChannelId) return;
        
        const logChannel = member.guild.channels.cache.get(settings.protection.logChannelId) as TextChannel;
        if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

        const locale = client.locales.get(client.defaultLanguage)?.protection.antibot;
        if (!locale) return;

        const embed = new EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor((settings.protection?.antibot?.color || '#ff0000') as `#${string}`)
            .addFields([
                {
                    name: `👤 ${locale.member}`,
                    value: `${member.user.tag} (<@${member.id}>)`,
                    inline: true
                },
                {
                    name: `🤖 ${locale.bot}`,
                    value: `${bot.tag} (<@${bot.id}>)`,
                    inline: true
                },
                {
                    name: `🛡️ ${locale.action}`,
                    value: locale.actions[settings.protection.antibot.action.type as keyof typeof locale.actions],
                    inline: true
                }
            ])
            .setFooter({ 
                text: `${locale.memberId}: ${member.id} | ${locale.botId}: ${bot.id}` 
            })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error sending protection log:', error);
    }
}; 
