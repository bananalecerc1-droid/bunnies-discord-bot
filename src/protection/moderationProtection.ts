import { canManageMember, manageableRoles } from '../utils/memberSafety';
import { GuildMember, EmbedBuilder, TextChannel, ChannelType, User } from 'discord.js';
import { ModBot } from '../types/ModBot';

const actionTracker = new Map<string, {
    kicks: number;
    bans: number;
    unbans: number;
    lastReset: number;
}>();

const resetCounters = (userId: string, settings: any) => {
    const now = Date.now();
    const userData = actionTracker.get(userId);
    if (userData && now - userData.lastReset >= settings.protection.moderation.limits.timeWindow) {
        actionTracker.set(userId, {
            kicks: 0,
            bans: 0,
            unbans: 0,
            lastReset: now
        });
    }
};

const takeAction = async (member: GuildMember, reason: string) => {
    const client = member.client as ModBot;
    const settings = client.settings;
    const { action } = settings.protection.moderation;

    try {
        if (!canManageMember(member)) {
            console.warn(`[protection] Skipping action for unmanaged member ${member.id}`);
            return;
        }
        switch (action.type) {
            case 'removeRoles':
                const roles = manageableRoles(member, action.ignoredRoles);
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
    } catch (error: any) {
        if (error?.code === 50013 || error?.status === 403) {
            console.warn(`[protection] Discord refused action for member ${member.id} (insufficient permissions or role hierarchy).`);
            return;
        }
        console.error('Error taking protection action:', error);
    }
};

const sendProtectionLog = async (
    client: ModBot,
    member: GuildMember,
    actionType: string,
    targetUser: User | GuildMember,
    limitType: string,
    limit: number
) => {
    const settings = client.settings;
    try {
        if (!settings.protection?.logChannelId) return;
        
        const logChannel = member.guild.channels.cache.get(settings.protection.logChannelId) as TextChannel;
        if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

        const locale = client.locales.get(client.defaultLanguage)?.protection.moderation;
        if (!locale) return;

        const embed = new EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor((settings.protection?.moderation?.color || '#ff0000') as `#${string}`)
            .addFields([
                {
                    name: `👤 ${locale.member}`,
                    value: `${member.user.tag} (<@${member.id}>)`,
                    inline: true
                },
                {
                    name: `🎯 ${locale.targetMember}`,
                    value: `${targetUser instanceof User ? targetUser.tag : targetUser.user.tag} (<@${targetUser.id}>)`,
                    inline: true
                },
                {
                    name: `⚡ ${locale.actionType}`,
                    value: locale.types[actionType as keyof typeof locale.types],
                    inline: true
                },
                {
                    name: `🛡️ ${locale.action}`,
                    value: locale.actions[settings.protection.moderation.action.type as keyof typeof locale.actions],
                    inline: true
                },
                {
                    name: `⏰ ${locale.timeWindow}`,
                    value: `${settings.protection.moderation.limits.timeWindow / 1000} ${locale.seconds}`,
                    inline: true
                },
                {
                    name: `📊 ${locale.limit}`,
                    value: `${locale[limitType]}: ${limit}`,
                    inline: true
                }
            ])
            .setFooter({ text: `${locale.memberId}: ${member.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error sending protection log:', error);
    }
};

export const handleKick = async (member: GuildMember, executor: GuildMember) => {
    const client = member.client as ModBot;
    const settings = client.settings;

    if (!settings.protection.enabled || settings.protection.moderation.enabled === false) return;

    try {
        if (executor.roles.cache.some(role => 
            settings.protection.moderation.action.ignoredRoles.includes(role.id)
        )) return;

        resetCounters(executor.id, settings);

        let userData = actionTracker.get(executor.id);
        if (!userData) {
            userData = {
                kicks: 0,
                bans: 0,
                unbans: 0,
                lastReset: Date.now()
            };
            actionTracker.set(executor.id, userData);
        }

        userData.kicks++;

        if (userData.kicks >= settings.protection.moderation.limits.kickLimit) {
            await takeAction(
                executor,
                settings.protection.moderation.action.reason
            );

            await sendProtectionLog(
                client,
                executor,
                'kick',
                member,
                'kickLimit',
                settings.protection.moderation.limits.kickLimit
            );
        }
    } catch (error) {
        console.error('Error in kick protection:', error);
    }
};

export const handleBan = async (user: User, executor: GuildMember) => {
    const client = executor.client as ModBot;
    const settings = client.settings;

    if (!settings.protection.enabled || settings.protection.moderation.enabled === false) return;

    try {
        if (executor.roles.cache.some(role => 
            settings.protection.moderation.action.ignoredRoles.includes(role.id)
        )) return;

        resetCounters(executor.id, settings);

        let userData = actionTracker.get(executor.id);
        if (!userData) {
            userData = {
                kicks: 0,
                bans: 0,
                unbans: 0,
                lastReset: Date.now()
            };
            actionTracker.set(executor.id, userData);
        }

        userData.bans++;

        if (userData.bans >= settings.protection.moderation.limits.banLimit) {
            await takeAction(
                executor,
                settings.protection.moderation.action.reason
            );

            await sendProtectionLog(
                client,
                executor,
                'ban',
                user,
                'banLimit',
                settings.protection.moderation.limits.banLimit
            );
        }
    } catch (error) {
        console.error('Error in ban protection:', error);
    }
};

export const handleUnban = async (user: User, executor: GuildMember) => {
    const client = executor.client as ModBot;
    const settings = client.settings;

    if (!settings.protection.enabled || settings.protection.moderation.enabled === false) return;

    try {
        if (executor.roles.cache.some(role => 
            settings.protection.moderation.action.ignoredRoles.includes(role.id)
        )) return;

        resetCounters(executor.id, settings);

        let userData = actionTracker.get(executor.id);
        if (!userData) {
            userData = {
                kicks: 0,
                bans: 0,
                unbans: 0,
                lastReset: Date.now()
            };
            actionTracker.set(executor.id, userData);
        }

        userData.unbans++;

        if (userData.unbans >= settings.protection.moderation.limits.unbanLimit) {
            await takeAction(
                executor,
                settings.protection.moderation.action.reason
            );

            await sendProtectionLog(
                client,
                executor,
                'unban',
                user,
                'unbanLimit',
                settings.protection.moderation.limits.unbanLimit
            );
        }
    } catch (error) {
        console.error('Error in unban protection:', error);
    }
}; 
