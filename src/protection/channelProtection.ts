import { canManageMember, manageableRoles } from '../utils/memberSafety';
import { isIgnorableDiscordStateError } from '../utils/discordErrors';
import { EmbedBuilder, TextChannel, ChannelType, GuildMember, AuditLogEvent, DMChannel, NonThreadGuildBasedChannel } from 'discord.js';
import { ModBot } from '../types/ModBot';

const actionTracker = new Map<string, {
    creates: number;
    deletes: number;
    updates: number;
    lastReset: number;
}>();

const resetCounters = (userId: string, settings: any) => {
    const now = Date.now();
    const userData = actionTracker.get(userId);
    if (userData && now - userData.lastReset >= settings.protection.channel.limits.timeWindow) {
        actionTracker.set(userId, {
            creates: 0,
            deletes: 0,
            updates: 0,
            lastReset: now
        });
    }
};

const takeAction = async (member: GuildMember, reason: string) => {
    const client = member.client as ModBot;
    const settings = client.settings;
    const { action } = settings.protection.channel;

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
    channelName: string,
    limitType: string,
    limit: number
) => {
    const settings = client.settings;
    try {
        if (!settings.protection?.logChannelId) return;
        
        const logChannel = member.guild.channels.cache.get(settings.protection.logChannelId) as TextChannel;
        if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

        const locale = client.locales.get(client.defaultLanguage)?.protection.channel;
        if (!locale) return;

        const embed = new EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor((settings.protection?.channel?.color || '#ff0000') as `#${string}`)
            .addFields([
                {
                    name: `👤 ${locale.member}`,
                    value: `${member.user.tag} (<@${member.id}>)`,
                    inline: true
                },
                {
                    name: `📝 ${locale.channelName}`,
                    value: channelName,
                    inline: true
                },
                {
                    name: `⚡ ${locale.actionType}`,
                    value: locale.types[actionType as keyof typeof locale.types],
                    inline: true
                },
                {
                    name: `🛡️ ${locale.action}`,
                    value: locale.actions[settings.protection.channel.action.type as keyof typeof locale.actions],
                    inline: true
                },
                {
                    name: `⏰ ${locale.timeWindow}`,
                    value: `${settings.protection.channel.limits.timeWindow / 1000} ${locale.seconds}`,
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

export const handleChannelCreate = async (channel: NonThreadGuildBasedChannel) => {
    const client = channel.client as ModBot;
    const settings = client.settings;

    if (!settings.protection.enabled || settings.protection.channel.enabled === false) return;
    if (!('guild' in channel)) return; // Skip DM channels

    try {
        const auditLogs = await channel.guild.fetchAuditLogs({
            type: AuditLogEvent.ChannelCreate,
            limit: 1
        });

        const log = auditLogs.entries.first();
        if (!log || !log.executor) return;

        const member = await channel.guild.members.fetch(log.executor.id);
        if (member.roles.cache.some(role => 
            settings.protection.channel.action.ignoredRoles.includes(role.id)
        )) return;

        resetCounters(log.executor.id, settings);

        let userData = actionTracker.get(log.executor.id);
        if (!userData) {
            userData = {
                creates: 0,
                deletes: 0,
                updates: 0,
                lastReset: Date.now()
            };
            actionTracker.set(log.executor.id, userData);
        }

        userData.creates++;

        if (userData.creates >= settings.protection.channel.limits.createLimit) {
            await takeAction(
                member,
                settings.protection.channel.action.reason
            );

            await sendProtectionLog(
                client,
                member,
                'create',
                channel.name,
                'createLimit',
                settings.protection.channel.limits.createLimit
            );
        }
    } catch (error) {
        console.error('Error in channel create protection:', error);
    }
};

export const handleChannelDelete = async (channel: DMChannel | NonThreadGuildBasedChannel) => {
    const client = channel.client as ModBot;
    const settings = client.settings;

    if (!settings.protection.enabled || !settings.protection.channel.enabled) return;
    if (!('guild' in channel)) return; // Skip DM channels

    try {
        const auditLogs = await channel.guild.fetchAuditLogs({
            type: AuditLogEvent.ChannelDelete,
            limit: 1
        });

        const log = auditLogs.entries.first();
        if (!log || !log.executor) return;

        const member = await channel.guild.members.fetch(log.executor.id);
        if (member.roles.cache.some(role => 
            settings.protection.channel.action.ignoredRoles.includes(role.id)
        )) return;

        resetCounters(log.executor.id, settings);

        let userData = actionTracker.get(log.executor.id);
        if (!userData) {
            userData = {
                creates: 0,
                deletes: 0,
                updates: 0,
                lastReset: Date.now()
            };
            actionTracker.set(log.executor.id, userData);
        }

        userData.deletes++;

        if (userData.deletes >= settings.protection.channel.limits.deleteLimit) {
            await takeAction(
                member,
                settings.protection.channel.action.reason
            );

            await sendProtectionLog(
                client,
                member,
                'delete',
                channel.name,
                'deleteLimit',
                settings.protection.channel.limits.deleteLimit
            );
        }
    } catch (error) {
        console.error('Error in channel delete protection:', error);
    }
};

export const handleChannelUpdate = async (
    oldChannel: DMChannel | NonThreadGuildBasedChannel,
    newChannel: DMChannel | NonThreadGuildBasedChannel
) => {
    const client = oldChannel.client as ModBot;
    const settings = client.settings;

    if (!settings.protection.enabled || !settings.protection.channel.enabled) return;
    if (!('guild' in oldChannel) || !('guild' in newChannel)) return; // Skip DM channels

    try {
        const auditLogs = await newChannel.guild.fetchAuditLogs({
            type: AuditLogEvent.ChannelUpdate,
            limit: 1
        });

        const log = auditLogs.entries.first();
        if (!log || !log.executor) return;

        const member = await newChannel.guild.members.fetch(log.executor.id);
        if (member.roles.cache.some(role => 
            settings.protection.channel.action.ignoredRoles.includes(role.id)
        )) return;

        const hasNameChange = oldChannel.name !== newChannel.name;
        const hasPermissionChange = JSON.stringify(oldChannel.permissionOverwrites.cache) !== 
                                  JSON.stringify(newChannel.permissionOverwrites.cache);
        const hasTypeChange = oldChannel.type !== newChannel.type;
        const hasTopicChange = 'topic' in oldChannel && 'topic' in newChannel && 
                             oldChannel.topic !== newChannel.topic;

        if (!hasNameChange && !hasPermissionChange && !hasTypeChange && !hasTopicChange) return;

        resetCounters(log.executor.id, settings);

        let userData = actionTracker.get(log.executor.id);
        if (!userData) {
            userData = {
                creates: 0,
                deletes: 0,
                updates: 0,
                lastReset: Date.now()
            };
            actionTracker.set(log.executor.id, userData);
        }

        userData.updates++;

        if (userData.updates >= settings.protection.channel.limits.updateLimit) {
            await takeAction(
                member,
                settings.protection.channel.action.reason
            );

            await sendProtectionLog(
                client,
                member,
                'update',
                newChannel.name,
                'updateLimit',
                settings.protection.channel.limits.updateLimit
            );
        }
    } catch (error) {
        if (isIgnorableDiscordStateError(error)) return;
        console.error('Error in channel update protection:', error);
    }
}; 
